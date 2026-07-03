#!/usr/bin/env node
/**
 * generate-tintamap-keys.mjs
 * -----------------------------------------------------------
 * Inventario reproducible de keys NFC para "Tinta estuvo aquí".
 *
 * Modos:
 *   (default)          Regenera los artefactos DEV a partir de los
 *                      tokens fijos TOKEN_A0X_DEV, sin tocar la base.
 *   --production       Genera 9 keys aleatorias (32 bytes, base64url)
 *                      y un archivo de importación SQL privado.
 *                      NO modifica la base automáticamente.
 *   --verify-dev       Calcula los 9 hashes SHA-256(key||pepper),
 *                      los compara contra node_placements.access_key_hash
 *                      en la base local, imprime MATCH/MISMATCH por
 *                      placement y termina con exit code 1 si hay
 *                      cualquier diferencia.
 *
 * Salidas privadas (todas dentro de /private/, ignoradas por Git):
 *   dev-node-keys.csv
 *   dev-node-urls.txt
 *   key-generation-report.md
 *   prod-node-keys.csv           (sólo --production)
 *   prod-node-urls.txt           (sólo --production)
 *   prod-node-import.sql         (sólo --production)
 *
 * Reglas de seguridad codificadas aquí:
 *   - El pepper NUNCA se escribe en ningún archivo de salida.
 *   - El service_role JWT NUNCA se lee ni imprime por este script.
 *   - Los recovery_code y otras credenciales de explorador NUNCA se
 *     tocan; este script sólo trabaja con access keys de placement.
 *   - --production requiere el env var TINTAMAP_PEPPER explícito (no
 *     hace fallback a supabase/.env.local) para evitar que alguien
 *     use por accidente el pepper de desarrollo para producción.
 * -----------------------------------------------------------
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const PRIVATE_DIR = path.join(REPO_ROOT, 'private', 'tinta-estuvo-aqui');

const KEY_VERSION_DEV = 'v1-dev';
const KEY_VERSION_PROD = 'v1-prod';

const LOCAL_BASE_URL = 'http://localhost:4321';

// Registro fijo del piloto DEV. Compatible con supabase/seed.sql.
const DEV_REGISTRY = [
  { family_id: 'FAMILY-A', placement_id: 'A-01', location_id: 'LOC-A-01', access_key: 'TOKEN_A01_DEV', status: 'active' },
  { family_id: 'FAMILY-A', placement_id: 'A-02', location_id: 'LOC-A-02', access_key: 'TOKEN_A02_DEV', status: 'active' },
  { family_id: 'FAMILY-A', placement_id: 'A-03', location_id: 'LOC-A-03', access_key: 'TOKEN_A03_DEV', status: 'active' },
  { family_id: 'FAMILY-B', placement_id: 'B-01', location_id: 'LOC-B-01', access_key: 'TOKEN_B01_DEV', status: 'active' },
  { family_id: 'FAMILY-B', placement_id: 'B-02', location_id: 'LOC-B-02', access_key: 'TOKEN_B02_DEV', status: 'active' },
  { family_id: 'FAMILY-B', placement_id: 'B-03', location_id: 'LOC-B-03', access_key: 'TOKEN_B03_DEV', status: 'active' },
  { family_id: 'FAMILY-C', placement_id: 'C-01', location_id: 'LOC-C-01', access_key: 'TOKEN_C01_DEV', status: 'active' },
  { family_id: 'FAMILY-C', placement_id: 'C-02', location_id: 'LOC-C-02', access_key: 'TOKEN_C02_DEV', status: 'active' },
  { family_id: 'FAMILY-C', placement_id: 'C-03', location_id: 'LOC-C-03', access_key: 'TOKEN_C03_DEV', status: 'active' },
];

// -----------------------------------------------------------
// Utilidades
// -----------------------------------------------------------

function parseMode(argv) {
  const flags = new Set(argv.slice(2));
  if (flags.has('--verify-dev') && flags.has('--production')) {
    throw new Error('No combines --verify-dev con --production.');
  }
  if (flags.has('--verify-dev')) return 'verify-dev';
  if (flags.has('--production')) return 'production';
  return 'dev';
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Carga TINTAMAP_PEPPER. En dev/verify hace fallback a supabase/.env.local.
 * En production NO hace fallback: exige env var explícito.
 */
function loadPepper(mode) {
  if (process.env.TINTAMAP_PEPPER) return process.env.TINTAMAP_PEPPER;
  if (mode === 'production') {
    throw new Error(
      '--production requiere TINTAMAP_PEPPER como variable de entorno explícita.\n' +
      '  Ejemplo:  $env:TINTAMAP_PEPPER = "<pepper de producción>"; node scripts/generate-tintamap-keys.mjs --production',
    );
  }
  // dev / verify: intenta supabase/.env.local
  const envLocal = path.join(REPO_ROOT, 'supabase', '.env.local');
  if (fs.existsSync(envLocal)) {
    const content = fs.readFileSync(envLocal, 'utf8');
    const line = content.split(/\r?\n/).find((l) => /^\s*TINTAMAP_PEPPER\s*=/.test(l));
    if (line) {
      const value = line.replace(/^\s*TINTAMAP_PEPPER\s*=\s*/, '').trim();
      return value.replace(/^["']|["']$/g, '');
    }
  }
  throw new Error(
    'No se encontró TINTAMAP_PEPPER. Define el env var o ponlo en supabase/.env.local.',
  );
}

function ensurePrivateDir() {
  fs.mkdirSync(PRIVATE_DIR, { recursive: true });
  const readme = path.join(PRIVATE_DIR, 'README.txt');
  if (!fs.existsSync(readme)) {
    fs.writeFileSync(
      readme,
      [
        'Esta carpeta es PRIVADA. Está ignorada por Git.',
        'Contiene keys NFC de dev/producción y no debe copiarse fuera del equipo.',
        'Regenerar con: node scripts/generate-tintamap-keys.mjs [--production|--verify-dev]',
        '',
      ].join('\n'),
      'utf8',
    );
  }
}

function localUrlFor(accessKey) {
  return `${LOCAL_BASE_URL}/tinta/tintamap/nodo?k=${encodeURIComponent(accessKey)}`;
}

function nowIso() {
  return new Date().toISOString();
}

// -----------------------------------------------------------
// Modo DEV
// -----------------------------------------------------------

function runDev() {
  ensurePrivateDir();
  loadPepper('dev'); // valida que exista, no lo escribe

  // CSV
  const csvHeader = ['family_id','placement_id','location_id','key_version','access_key','status','local_test_url'].join(',');
  const csvRows = DEV_REGISTRY.map((r) => [
    r.family_id,
    r.placement_id,
    r.location_id,
    KEY_VERSION_DEV,
    r.access_key,
    r.status,
    localUrlFor(r.access_key),
  ].join(','));
  const csvPath = path.join(PRIVATE_DIR, 'dev-node-keys.csv');
  fs.writeFileSync(csvPath, csvHeader + '\n' + csvRows.join('\n') + '\n', 'utf8');

  // URLs planas
  const urlsPath = path.join(PRIVATE_DIR, 'dev-node-urls.txt');
  const urls = DEV_REGISTRY.map((r) => `${r.placement_id}\t${localUrlFor(r.access_key)}`).join('\n');
  fs.writeFileSync(urlsPath, urls + '\n', 'utf8');

  // Reporte (sin pepper, sin hash — sólo inventario y comandos)
  const reportPath = path.join(PRIVATE_DIR, 'key-generation-report.md');
  const report = [
    '# Reporte de generación de keys — Tinta estuvo aquí',
    '',
    `Fecha: ${nowIso()}`,
    `Modo: dev (registro fijo)`,
    `Versión de key: ${KEY_VERSION_DEV}`,
    '',
    '## Placements inventariados',
    '',
    '| family_id | placement_id | location_id | status |',
    '|---|---|---|---|',
    ...DEV_REGISTRY.map((r) => `| ${r.family_id} | ${r.placement_id} | ${r.location_id} | ${r.status} |`),
    '',
    '## Archivos generados',
    '',
    '- `dev-node-keys.csv` — inventario completo con keys y URLs (privado).',
    '- `dev-node-urls.txt` — sólo URLs, para pegar en un lector NFC de escritorio.',
    '',
    '## Verificar contra la base local',
    '',
    '```bash',
    'node scripts/generate-tintamap-keys.mjs --verify-dev',
    '```',
    '',
    'Debe imprimir `MATCH` para los 9 placements y salir con exit code 0.',
    'Si aparece `MISMATCH` en alguno, la seed y las Edge Functions están usando peppers distintos.',
    '',
    '## No compartir',
    '',
    'Este archivo vive en `private/` y está ignorado por Git.',
    'Los tokens de dev son de bajo riesgo (sólo abren la Supabase local),',
    'pero se manejan con la misma disciplina que las keys de producción.',
    '',
  ].join('\n');
  fs.writeFileSync(reportPath, report, 'utf8');

  console.log('[tintamap] modo dev — 3 archivos escritos en', PRIVATE_DIR);
  console.log('  •', path.relative(REPO_ROOT, csvPath));
  console.log('  •', path.relative(REPO_ROOT, urlsPath));
  console.log('  •', path.relative(REPO_ROOT, reportPath));
}

// -----------------------------------------------------------
// Modo PRODUCTION
// -----------------------------------------------------------

function generateRandomToken() {
  // 32 bytes = 256 bits, encoded como base64url (sin padding).
  return crypto.randomBytes(32).toString('base64url');
}

function runProduction() {
  ensurePrivateDir();
  const pepper = loadPepper('production');

  // Sanity check: no permitir que el pepper de prod sea el conocido de dev.
  if (pepper === 'dev-pepper-change-me') {
    throw new Error(
      'El TINTAMAP_PEPPER pasado es el pepper conocido de desarrollo. ' +
      'No puedes usarlo para producción. Rota primero y vuelve a correr.',
    );
  }

  const rows = DEV_REGISTRY.map((r) => {
    let token;
    do { token = generateRandomToken(); } while (r.access_key === token);
    return {
      family_id: r.family_id,
      placement_id: r.placement_id,
      location_id: r.location_id,
      status: 'draft',            // en prod se instala como draft; se activa después de la revisión física
      access_key: token,
      access_key_hash: sha256Hex(token + pepper),
    };
  });

  // CSV (privado, con la key en texto plano — ES OBLIGATORIO tratarlo como secreto)
  const csvHeader = ['family_id','placement_id','location_id','key_version','access_key','status','local_test_url'].join(',');
  const csvRows = rows.map((r) => [
    r.family_id, r.placement_id, r.location_id, KEY_VERSION_PROD, r.access_key, r.status,
    // 'local_test_url' en prod carece de sentido, pero conservamos la columna para
    // simetría con dev; ponemos la URL de dev-loopback vacía.
    '',
  ].join(','));
  const csvPath = path.join(PRIVATE_DIR, 'prod-node-keys.csv');
  fs.writeFileSync(csvPath, csvHeader + '\n' + csvRows.join('\n') + '\n', 'utf8');

  // URLs de producción — no las conocemos, dependen del dominio final;
  // dejamos el path pero SIN host (para que quien programe la etiqueta
  // NFC prefije el host correcto). No hardcodeamos ningún dominio.
  const urlsPath = path.join(PRIVATE_DIR, 'prod-node-urls.txt');
  const urls = rows.map((r) => `${r.placement_id}\t/tinta/tintamap/nodo?k=${encodeURIComponent(r.access_key)}`).join('\n');
  fs.writeFileSync(urlsPath, urls + '\n', 'utf8');

  // SQL de importación privada — SOLO trae los HASHES, no las keys.
  const sqlPath = path.join(PRIVATE_DIR, 'prod-node-import.sql');
  const sqlHeader = [
    '-- Importación privada de keys de producción — Tinta estuvo aquí',
    '-- Generado por scripts/generate-tintamap-keys.mjs',
    `-- Fecha: ${nowIso()}`,
    `-- Versión de key: ${KEY_VERSION_PROD}`,
    '--',
    '-- IMPORTANTE: este archivo contiene HASHES, no tokens en claro.',
    '-- Ejecutarlo en la base de producción vía canal seguro (psql sobre SSH).',
    '-- El pepper NUNCA está en este archivo; debe coincidir con el TINTAMAP_PEPPER',
    '-- configurado en `supabase secrets` para que unlock-node valide las keys.',
    '',
    'begin;',
    '',
  ].join('\n');
  const sqlBody = rows.map((r) => `insert into public.node_placements
  (id, family_id, location_id, display_name, access_key_hash, status)
values
  ('${r.placement_id}', '${r.family_id}', '${r.location_id}', 'Aparición ${r.placement_id}', '${r.access_key_hash}', '${r.status}')
on conflict (id) do update
  set access_key_hash = excluded.access_key_hash,
      updated_at      = now();`).join('\n\n');
  fs.writeFileSync(sqlPath, sqlHeader + sqlBody + '\n\ncommit;\n', 'utf8');

  // Reporte de producción
  const reportPath = path.join(PRIVATE_DIR, 'key-generation-report.md');
  const report = [
    '# Reporte de generación de keys — Tinta estuvo aquí (PRODUCCIÓN)',
    '',
    `Fecha: ${nowIso()}`,
    `Modo: production`,
    `Versión de key: ${KEY_VERSION_PROD}`,
    `Placements generados: ${rows.length}`,
    '',
    '## Archivos generados (todos privados)',
    '',
    '- `prod-node-keys.csv` — inventario con tokens en claro.',
    '  ⚠️  Este archivo es equivalente a "las llaves de la casa". Guárdalo cifrado.',
    '- `prod-node-urls.txt` — path + query, sin host. Prefija con tu dominio al programar la NFC.',
    '- `prod-node-import.sql` — sólo hashes. Aplícalo en la base de producción.',
    '',
    '## Regla de coherencia',
    '',
    'El hash guardado en `access_key_hash` fue calculado como:',
    '',
    '```',
    'sha256( access_key + TINTAMAP_PEPPER )  # UTF-8, hex minúsculo',
    '```',
    '',
    'El PEPPER usado en esta corrida debe coincidir bit-a-bit con el',
    '`TINTAMAP_PEPPER` configurado como secreto de las Edge Functions en',
    'producción. Si no coincide, unlock-node devolverá "no encontramos esta aparición".',
    '',
    '## Siguiente paso (manual, deliberadamente NO automatizado)',
    '',
    '1. Revisar el CSV.',
    '2. Aplicar `prod-node-import.sql` en la base de producción vía canal seguro.',
    '3. Programar las etiquetas NFC con las URLs de `prod-node-urls.txt` prefijadas con el dominio real.',
    '4. Guardar el CSV en el gestor de secretos del equipo.',
    '5. NO commitear ninguno de estos archivos.',
    '',
    '## No se incluye en ningún archivo',
    '',
    '- El PEPPER en claro.',
    '- El JWT `service_role`.',
    '- Ninguna credencial de explorer.',
    '',
  ].join('\n');
  fs.writeFileSync(reportPath, report, 'utf8');

  console.log('[tintamap] modo production — 4 archivos escritos en', PRIVATE_DIR);
  console.log('  •', path.relative(REPO_ROOT, csvPath), ' (tokens en claro — trata como secreto)');
  console.log('  •', path.relative(REPO_ROOT, urlsPath));
  console.log('  •', path.relative(REPO_ROOT, sqlPath), ' (aplica manualmente en la base de prod)');
  console.log('  •', path.relative(REPO_ROOT, reportPath));
}

// -----------------------------------------------------------
// Modo VERIFY-DEV
// -----------------------------------------------------------

function discoverDbContainer() {
  try {
    const names = execSync('docker ps --filter name=supabase_db_ --format {{.Names}}', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim().split(/\r?\n/).filter(Boolean);
    if (names.length === 0) return null;
    // El primero suele ser el correcto (proyecto actual).
    return names[0];
  } catch { return null; }
}

function queryStoredHash(container, placementId) {
  // Uso el rol postgres del container, NUNCA la service_role JWT.
  // Escapado: placementId proviene del registro fijo (no input externo).
  const sql = `select access_key_hash from public.node_placements where id='${placementId}';`;
  const out = execSync(
    `docker exec -e PGPASSWORD=postgres ${container} psql -U postgres -tAc "${sql}"`,
    { stdio: ['ignore', 'pipe', 'pipe'] },
  ).toString().trim();
  return out || null;
}

function runVerifyDev() {
  const pepper = loadPepper('verify-dev');
  const container = discoverDbContainer();
  if (!container) {
    console.error('[tintamap] verify-dev: no encontré un container `supabase_db_*` corriendo.');
    console.error('  Arranca la pila local con:  npx supabase start');
    process.exit(2);
  }

  console.log(`[tintamap] verify-dev usando container: ${container}`);
  console.log('placement | expected (first 12) | stored (first 12) | result');
  console.log('----------+---------------------+-------------------+-------');

  let mismatches = 0;
  for (const r of DEV_REGISTRY) {
    const expected = sha256Hex(r.access_key + pepper);
    let stored;
    try { stored = queryStoredHash(container, r.placement_id); }
    catch (e) {
      console.log(`${r.placement_id.padEnd(9)} | ${expected.slice(0,12)}...       | (query error)     | ERROR`);
      mismatches++;
      continue;
    }
    if (!stored) {
      console.log(`${r.placement_id.padEnd(9)} | ${expected.slice(0,12)}...       | (no row)          | MISSING`);
      mismatches++;
      continue;
    }
    const ok = stored === expected;
    if (!ok) mismatches++;
    console.log(
      `${r.placement_id.padEnd(9)} | ${expected.slice(0,12)}...       | ${stored.slice(0,12)}...     | ${ok ? 'MATCH' : 'MISMATCH'}`,
    );
  }

  if (mismatches > 0) {
    console.error(`\n[tintamap] verify-dev: ${mismatches} discrepancia(s) — el PEPPER local NO coincide con el usado en la seed.`);
    process.exit(1);
  }
  console.log('\n[tintamap] verify-dev: OK — todos los hashes coinciden.');
}

// -----------------------------------------------------------
// Entry point
// -----------------------------------------------------------

(function main() {
  let mode;
  try { mode = parseMode(process.argv); }
  catch (e) { console.error(String(e.message || e)); process.exit(2); }

  try {
    if (mode === 'dev') runDev();
    else if (mode === 'production') runProduction();
    else if (mode === 'verify-dev') runVerifyDev();
  } catch (e) {
    console.error('[tintamap] error:', e.message || e);
    process.exit(2);
  }
})();
