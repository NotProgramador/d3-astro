// Wrapper de las Edge Functions de Tinta estuvo aquí.
// Todas las llamadas envían device_token (creado/leído desde storage).

import { getOrCreateDeviceToken } from './tintamap-storage';

const FUNCTIONS_URL = (import.meta.env.PUBLIC_TINTAMAP_FUNCTIONS_URL as string | undefined)?.replace(/\/$/, '');
const ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

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
}

async function callFn<T = unknown>(name: string, payload: Record<string, unknown>): Promise<T> {
  if (!FUNCTIONS_URL || !ANON_KEY) {
    throw new Error('Supabase no configurado. Revisa .env');
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

export function isTintaMapConfigured(): boolean {
  return Boolean(FUNCTIONS_URL && ANON_KEY);
}
