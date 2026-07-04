// Wrapper de las Edge Functions de Tinta estuvo aquí.
// Todas las llamadas envían device_token (creado/leído desde storage).

import { getOrCreateDeviceToken } from './tintamap-storage';

const FUNCTIONS_URL = (import.meta.env.PUBLIC_TINTAMAP_FUNCTIONS_URL as string | undefined)?.replace(/\/$/, '');
const ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;
const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;

/**
 * Error distinguible: la app NO está configurada (falta env var en el build).
 * Diferente de un error de red o de una respuesta del backend.
 */
export class TintamapNotConfiguredError extends Error {
  code = 'not_configured' as const;
  constructor() {
    super('Tinta aún no está conectada. Faltan variables PUBLIC_* en el build.');
  }
}

// Log seguro de arranque. NO imprime valores (ni siquiera parciales de la key);
// sólo presencia. Visible en DevTools → Console.
if (typeof window !== 'undefined') {
  const host = FUNCTIONS_URL ? safeHost(FUNCTIONS_URL) : null;
  const supabaseHost = SUPABASE_URL ? safeHost(SUPABASE_URL) : null;
  // eslint-disable-next-line no-console
  console.info('[tintamap config]', {
    hasSupabaseUrl: Boolean(SUPABASE_URL),
    hasAnonKey: Boolean(ANON_KEY),
    hasFunctionsUrl: Boolean(FUNCTIONS_URL),
    functionsUrlHost: host,
    supabaseUrlHost: supabaseHost,
  });
  if (!FUNCTIONS_URL || !ANON_KEY || !SUPABASE_URL) {
    // eslint-disable-next-line no-console
    console.warn(
      '[tintamap] Configuración incompleta. Astro hornea import.meta.env en build; ' +
      'si acabas de agregar variables en Netlify, dispara un redeploy con "Clear cache and deploy site".',
    );
  }
}

function safeHost(u: string): string | null {
  try { return new URL(u).host; } catch { return null; }
}

export interface UnlockNodeResult {
  ok: boolean;
  kind?: 'editorial' | 'neutral';
  title?: string;
  body?: string;
  is_first_scan_of_placement?: boolean;
  created_credentials?: { public_id: string; recovery_code: string };
  profile?: { public_id: string };
  placement?: {
    id: string;
    family_id: string;
    display_name: string | null;
    scan_count: number;
  };
  family?: {
    id: string;
    name: string;
    description: string | null;
    content_type: string | null;
    symbol: string | null;
    image_url: string | null;
    content: Record<string, unknown>;
    reward: Record<string, unknown>;
  };
  progress?: {
    discovered_count: number;
    families: Array<{ family_id: string; discovered: number; total: number; completed: boolean }>;
  };
  reward_claim?: any;
}

async function callFn<T = unknown>(name: string, payload: Record<string, unknown>): Promise<T> {
  if (!FUNCTIONS_URL || !ANON_KEY) {
    // Antes lanzábamos un Error genérico y la UI mostraba "No pudimos conectar",
    // que se confundía con caída de red. Ahora usamos una clase específica.
    throw new TintamapNotConfiguredError();
  }
  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
      'apikey': ANON_KEY,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({ ok: false, error: 'invalid_response' }));
  return data as T;
}

export function unlockNode(token: string): Promise<UnlockNodeResult> {
  return callFn<UnlockNodeResult>('unlock-node', {
    token,
    device_token: getOrCreateDeviceToken(),
  });
}

export function createExplorer(): Promise<any> {
  return callFn('create-explorer', { device_token: getOrCreateDeviceToken() });
}

/**
 * Peek: sólo devuelve estado existente. Nunca crea perfil. Úsalo en la
 * carga de /credencial para hidratar el estado desde backend (fuente de
 * verdad) sin efectos colaterales.
 */
export function probeExplorer(): Promise<any> {
  return callFn('create-explorer', { device_token: getOrCreateDeviceToken(), probe: true });
}

export function recoverByCode(recoveryCode: string): Promise<any> {
  return callFn('recover-by-code', {
    recovery_code: recoveryCode,
    device_token: getOrCreateDeviceToken(),
  });
}

export function attachRecoveryEmail(
  email: string,
  prefs: { clue_emails?: boolean; event_emails?: boolean; project_news?: boolean } = {},
  opts: { confirm_replace?: boolean } = {},
): Promise<any> {
  return callFn('attach-recovery-email', {
    device_token: getOrCreateDeviceToken(),
    email,
    prefs,
    confirm_replace: !!opts.confirm_replace,
  });
}

export function sendRecoveryEmail(email: string): Promise<any> {
  return callFn('send-recovery-email', { email });
}

/**
 * Envía por correo la credencial completa (public_id + fecha + progreso
 * + recovery_code opcional + claims), o solo un claim.
 * El recovery_code debe pasarse desde localStorage — el backend no lo
 * puede reconstruir (guarda sólo hash).
 */
export function sendCredentialEmail(opts: {
  mode?: 'credential' | 'claim';
  includeRecovery?: boolean;
  recoveryCode?: string;
} = {}): Promise<any> {
  return callFn('send-credential-email', {
    device_token: getOrCreateDeviceToken(),
    mode: opts.mode ?? 'credential',
    include_recovery: !!opts.includeRecovery,
    recovery_code: opts.recoveryCode ?? '',
  });
}

export function isTintaMapConfigured(): boolean {
  return Boolean(FUNCTIONS_URL && ANON_KEY);
}

export function isNotConfiguredError(e: unknown): boolean {
  return e instanceof TintamapNotConfiguredError;
}
