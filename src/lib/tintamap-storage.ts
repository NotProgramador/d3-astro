// Almacenamiento local de la credencial del explorador.
// device_token es opaco, se genera una vez y vive en localStorage.
// Todo lo demás (public_id, recovery_code, progreso) se puede reconstruir
// desde el backend, pero cacheamos algunos campos para UX offline.

const K_DEVICE = 'ddd.tintamap.device_token';
const K_PUBLIC = 'ddd.tintamap.public_id';
const K_RECOVERY = 'ddd.tintamap.recovery_code';
const K_CREATED = 'ddd.tintamap.created_at';
const K_PROGRESS = 'ddd.tintamap.progress';
const K_REC_STATE = 'ddd.tintamap.recovery_state';

export type RecoveryStatus = 'none' | 'pending' | 'verified';

export interface CachedRecoveryState {
  recovery_status: RecoveryStatus;
  has_recovery_email: boolean;
  masked_email: string | null;
  email_verified: boolean;
  preferences: {
    recovery_emails?: boolean;
    clue_emails?: boolean;
    event_emails?: boolean;
    project_news?: boolean;
  } | null;
  updated_at: string;
}

export interface CachedProgress {
  discovered_count: number;
  families: Array<{ family_id: string; discovered: number; total: number; completed: boolean }>;
  updated_at: string;
}

function safeLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getOrCreateDeviceToken(): string {
  const ls = safeLocalStorage();
  if (!ls) {
    // SSR/no-storage fallback: genera un token en memoria (no persistente).
    return generateToken();
  }
  let t = ls.getItem(K_DEVICE);
  if (!t) {
    t = generateToken();
    ls.setItem(K_DEVICE, t);
  }
  return t;
}

/**
 * ¿Ya existe un device_token en almacenamiento local? Sirve para decidir
 * si hidratar desde el backend en carga de página (perfil probable) o
 * mostrar directamente el estado vacío sin llamada de red.
 */
export function hasStoredDeviceToken(): boolean {
  return !!safeLocalStorage()?.getItem(K_DEVICE);
}

function generateToken(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID() + '-' + crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getStoredPublicId(): string | null {
  return safeLocalStorage()?.getItem(K_PUBLIC) ?? null;
}

export function setStoredPublicId(publicId: string): void {
  safeLocalStorage()?.setItem(K_PUBLIC, publicId);
}

export function getStoredRecoveryCode(): string | null {
  return safeLocalStorage()?.getItem(K_RECOVERY) ?? null;
}

export function setStoredRecoveryCode(code: string): void {
  safeLocalStorage()?.setItem(K_RECOVERY, code);
}

export function clearStoredRecoveryCode(): void {
  safeLocalStorage()?.removeItem(K_RECOVERY);
}

export function getStoredCreatedAt(): string | null {
  return safeLocalStorage()?.getItem(K_CREATED) ?? null;
}

export function setStoredCreatedAt(iso: string): void {
  safeLocalStorage()?.setItem(K_CREATED, iso);
}

export function getCachedProgress(): CachedProgress | null {
  const raw = safeLocalStorage()?.getItem(K_PROGRESS);
  if (!raw) return null;
  try { return JSON.parse(raw) as CachedProgress; } catch { return null; }
}

export function setCachedProgress(p: Omit<CachedProgress, 'updated_at'>): void {
  const ls = safeLocalStorage();
  if (!ls) return;
  ls.setItem(K_PROGRESS, JSON.stringify({ ...p, updated_at: new Date().toISOString() }));
}

/**
 * Cache de estado de recuperación de correo. NO es fuente de verdad;
 * sólo se usa para pintar rápido antes de hidratar desde backend.
 * El backend siempre gana en la hidratación.
 */
export function getCachedRecoveryState(): CachedRecoveryState | null {
  const raw = safeLocalStorage()?.getItem(K_REC_STATE);
  if (!raw) return null;
  try { return JSON.parse(raw) as CachedRecoveryState; } catch { return null; }
}

export function setCachedRecoveryState(s: Omit<CachedRecoveryState, 'updated_at'>): void {
  const ls = safeLocalStorage();
  if (!ls) return;
  ls.setItem(K_REC_STATE, JSON.stringify({ ...s, updated_at: new Date().toISOString() }));
}

export function clearCachedRecoveryState(): void {
  safeLocalStorage()?.removeItem(K_REC_STATE);
}

// -----------------------------------------------------------
// Claims (recompensas desbloqueadas)
// El backend es fuente de verdad; esto es cache local sólo para
// pintado inmediato.
// -----------------------------------------------------------
const K_CLAIMS = 'ddd.tintamap.claims';

export interface CachedClaim {
  family_id: string;
  family_name: string | null;
  reward_name: string;
  claim_code: string;
  status: string;
}

export function getCachedClaims(): CachedClaim[] {
  const raw = safeLocalStorage()?.getItem(K_CLAIMS);
  if (!raw) return [];
  try { return JSON.parse(raw) as CachedClaim[]; } catch { return []; }
}

export function setCachedClaims(claims: CachedClaim[]): void {
  safeLocalStorage()?.setItem(K_CLAIMS, JSON.stringify(claims));
}

export function upsertCachedClaim(claim: CachedClaim): void {
  const all = getCachedClaims();
  const idx = all.findIndex((c) => c.family_id === claim.family_id);
  if (idx >= 0) all[idx] = claim; else all.push(claim);
  setCachedClaims(all);
}

export function hasExplorer(): boolean {
  return !!getStoredPublicId();
}

export function forgetExplorer(): void {
  const ls = safeLocalStorage();
  if (!ls) return;
  ls.removeItem(K_DEVICE);
  ls.removeItem(K_PUBLIC);
  ls.removeItem(K_RECOVERY);
  ls.removeItem(K_CREATED);
  ls.removeItem(K_PROGRESS);
  ls.removeItem(K_REC_STATE);
  ls.removeItem(K_CLAIMS);
}
