#!/usr/bin/env node
/**
 * remote-smoke-test.mjs
 * ---------------------
 * Prueba humo de producción — verifica que:
 *   1) el sitio Netlify responde en /tinta/tintamap y en /_astro/*
 *   2) las Edge Functions remotas responden a unlock-node válido,
 *      unlock-node inválido, y send-recovery-email neutral
 *   3) el bundle JS de Netlify contiene el host de Supabase (env vars
 *      horneadas correctamente) o denuncia si está vacío
 *
 * NO imprime:
 *   - la anon key completa (sólo primeros/últimos 6 chars)
 *   - la dev token completa (sólo primeros 4 chars)
 *   - el recovery_code completo (sólo prefix)
 *   - service_role (jamás se usa aquí)
 *
 * Uso:
 *   node scripts/remote-smoke-test.mjs
 *   node scripts/remote-smoke-test.mjs --site https://otro-sitio.netlify.app
 *
 * Requisitos:
 *   - private/tinta-estuvo-aqui/dev-node-keys.csv debe existir
 *   - Variables opcionales de env:
 *       TINTAMAP_TEST_SITE (default: https://domingosdedibujar.netlify.app)
 *       TINTAMAP_TEST_API  (default: https://arrwnyyscatmvonveogg.supabase.co)
 *       TINTAMAP_TEST_ANON (obligatoria; se puede pegar al vuelo)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

// -----------------------------------------------------------
// Args + defaults
// -----------------------------------------------------------
const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i], process.argv[i + 1]);
}
const SITE = args.get('--site') ?? process.env.TINTAMAP_TEST_SITE ?? 'https://domingosdedibujar.netlify.app';
const API  = args.get('--api')  ?? process.env.TINTAMAP_TEST_API  ?? 'https://arrwnyyscatmvonveogg.supabase.co';
const PROJECT_REF = new URL(API).host.split('.')[0];

let ANON = process.env.TINTAMAP_TEST_ANON;
if (!ANON) {
  // Fallback: intentar leer del CLI supabase (si el usuario está logueado).
  try {
    const raw = execSync(`npx supabase projects api-keys --project-ref ${PROJECT_REF}`, {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString();
    const parsed = JSON.parse(raw);
    const found = parsed?.keys?.find((k) => k.id === 'anon' || k.name === 'anon');
    ANON = found?.api_key;
  } catch { /* si falla, seguimos sin anon: los tests de function darán error controlado */ }
}

// -----------------------------------------------------------
// Utilidades de logging seguro
// -----------------------------------------------------------
function mask(s, keep = 6) {
  if (!s) return '(vacío)';
  if (s.length <= keep * 2 + 3) return '***';
  return s.slice(0, keep) + '…' + s.slice(-keep);
}
function pass(label) { console.log(`  ✓ ${label}`); }
function fail(label, detail) {
  console.error(`  ✗ ${label}${detail ? ': ' + detail : ''}`);
  process.exitCode = 1;
}

// -----------------------------------------------------------
// Leer key privada de A-01 sin imprimirla
// -----------------------------------------------------------
function loadDevKey(placementId) {
  const csv = path.join(REPO_ROOT, 'private', 'tinta-estuvo-aqui', 'dev-node-keys.csv');
  if (!fs.existsSync(csv)) return null;
  const lines = fs.readFileSync(csv, 'utf8').split(/\r?\n/);
  for (const line of lines.slice(1)) {
    const cols = line.split(',');
    if (cols[1] === placementId) return cols[4];
  }
  return null;
}

async function post(fn, body, origin = SITE) {
  const res = await fetch(`${API}/functions/v1/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON ?? '',
      'Authorization': `Bearer ${ANON ?? ''}`,
      'Origin': origin,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, headers: res.headers };
}

async function get(url) {
  const res = await fetch(url, { redirect: 'follow' });
  const text = await res.text();
  return { status: res.status, text, url: res.url, headers: res.headers };
}

// -----------------------------------------------------------
// Suite
// -----------------------------------------------------------
console.log('╔════════════════════════════════════════════════════════════');
console.log('║ remote-smoke-test');
console.log(`║ SITE: ${SITE}`);
console.log(`║ API : ${API}`);
console.log(`║ ANON: ${mask(ANON ?? '')}`);
console.log('╚════════════════════════════════════════════════════════════');

(async () => {
  // 1. Sitio Netlify vivo
  console.log('\n[1] Sitio Netlify vivo');
  const idx = await get(`${SITE}/tinta/tintamap/`);
  if (idx.status === 200) pass(`/tinta/tintamap responde 200`);
  else fail(`/tinta/tintamap`, `HTTP ${idx.status}`);

  // 2. Bundle: env vars horneadas?
  console.log('\n[2] Env vars horneadas en el bundle');
  const assetMatches = idx.text.match(/\/_astro\/[a-zA-Z0-9_\-.]+\.js/g) ?? [];
  const uniqueAssets = [...new Set(assetMatches)];
  let bakedUrl = false, foundLocalhost = false;
  for (const asset of uniqueAssets.slice(0, 20)) {
    const chunk = await get(`${SITE}${asset}`);
    if (chunk.text.includes(new URL(API).host)) bakedUrl = true;
    if (/localhost|127\.0\.0\.1/.test(chunk.text)) foundLocalhost = true;
    // Detectar el patrón sospechoso: const a=void 0; que indica ANON_KEY undefined
    if (/\bconst\s+\w+\s*=\s*void 0\b/.test(chunk.text) && /Supabase no configurado/.test(chunk.text)) {
      fail('bundle sin ANON_KEY',
        `${asset} contiene "const X = void 0" y el throw "Supabase no configurado" — Netlify buildeó sin las env vars`);
    }
  }
  if (bakedUrl) pass(`al menos un chunk contiene "${new URL(API).host}"`);
  else fail('ningún chunk contiene el host de Supabase',
       `pega las 3 PUBLIC_* en Netlify y "Clear cache and deploy site"`);
  if (foundLocalhost) fail('bundle contiene localhost/127.0.0.1', 'algún build antiguo se mezcló');

  // 3. Edge Function unlock-node válido (si tenemos anon key + dev key)
  console.log('\n[3] unlock-node con key A-01 válida');
  const keyA01 = loadDevKey('A-01');
  if (!keyA01) {
    fail('no encontré A-01 en private/tinta-estuvo-aqui/dev-node-keys.csv',
         'corre: node scripts/generate-tintamap-keys.mjs');
  } else if (!ANON) {
    fail('no tengo anon key', 'export TINTAMAP_TEST_ANON=<anon key> o corre supabase login');
  } else {
    const device = `smoke-${Date.now()}`;
    const r = await post('unlock-node', { token: keyA01, device_token: device });
    if (r.status === 200 && r.json?.ok && r.json.reward_claim === null) {
      pass(`ok:true, first scan, progress ${r.json.progress.families.find(f=>f.family_id==='FAMILY-A')?.discovered}/3`);
      pass(`public_id creado: ${r.json.profile.public_id}`);
      pass(`recovery_code prefix: ${(r.json.created_credentials?.recovery_code ?? '').slice(0,3)}-****`);
    } else {
      fail('unlock-node A-01', `HTTP ${r.status} · ${JSON.stringify(r.json).slice(0, 200)}`);
    }
  }

  // 4. Edge Function con key inválida → editorial
  console.log('\n[4] unlock-node con key inválida');
  if (ANON) {
    const r = await post('unlock-node', { token: 'NO_EXISTE_' + Date.now(), device_token: `smoke-bad-${Date.now()}` });
    if (r.status === 200 && r.json?.ok === false && r.json?.kind === 'editorial') {
      pass(`editorial devuelto: "${r.json.title}"`);
    } else {
      fail('respuesta inesperada para key inválida', JSON.stringify(r.json).slice(0, 200));
    }
  }

  // 5. send-recovery-email neutral
  console.log('\n[5] send-recovery-email neutral (sin SMTP)');
  if (ANON) {
    const r = await post('send-recovery-email', { email: `smoke+${Date.now()}@example.com` });
    if (r.status === 200 && r.json?.ok === true && r.json?.kind === 'neutral') {
      pass(`respuesta neutral: "${r.json.message}"`);
    } else {
      fail('send-recovery-email', `HTTP ${r.status} · ${JSON.stringify(r.json).slice(0, 200)}`);
    }
  }

  // 6. CORS preflight desde el sitio
  console.log('\n[6] CORS preflight desde SITE');
  const cors = await fetch(`${API}/functions/v1/unlock-node`, {
    method: 'OPTIONS',
    headers: {
      'Origin': SITE,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,apikey,content-type',
    },
  });
  const acao = cors.headers.get('access-control-allow-origin');
  if (cors.status === 204 && acao === SITE) {
    pass(`ACAO = ${SITE}`);
  } else {
    fail('CORS preflight', `status ${cors.status}, ACAO=${acao}`);
  }

  console.log('\n' + (process.exitCode ? '❌ Alguna prueba falló.' : '✅ Todo verde.'));
})();
