// Helpers de enmascarado y estado normalizado de recuperación.
// El correo se enmascara antes de salir del backend para no exponer
// el valor completo por un canal que la persona pueda ver sin querer.

export type RecoveryStatus = "none" | "pending" | "verified";

/**
 * Enmascara un correo devolviendo `l••••@dominio.tld`.
 * Devuelve null si el input es null/undefined/vacío o si no tiene arroba.
 */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at <= 0 || at === email.length - 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const first = local[0] ?? "";
  return `${first}••••@${domain}`;
}

/**
 * Estado normalizado que consume el frontend.
 * El backend es la única fuente de verdad de este valor.
 */
export function computeRecoveryStatus(
  email: string | null | undefined,
  emailVerified: boolean | null | undefined,
): RecoveryStatus {
  if (!email) return "none";
  return emailVerified ? "verified" : "pending";
}
