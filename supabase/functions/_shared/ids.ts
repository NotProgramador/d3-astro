// Generadores de identificadores legibles para exploradores.
// public_id:      TINTA-XXXX   (4 chars, sin 0/O/I/1)
// recovery_code:  D3-XXXX-XXXX-XXXX

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0,O,I,1

function chunk(len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export function generatePublicId(): string {
  return `TINTA-${chunk(4)}`;
}

export function generateRecoveryCode(): string {
  return `D3-${chunk(4)}-${chunk(4)}-${chunk(4)}`;
}

/**
 * Claim code legible. Formato: CLAIM-TINTA-<L>-XXXX
 * donde <L> es la letra final del family_id (ej. 'A' de 'FAMILY-A').
 * Nunca reutiliza el public_id ni el recovery_code.
 */
export function generateClaimCode(familyId: string): string {
  const letter = (familyId.match(/-([A-Z])$/)?.[1] ?? "X").toUpperCase();
  return `CLAIM-TINTA-${letter}-${chunk(4)}`;
}
