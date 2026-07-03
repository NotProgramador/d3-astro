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

export function generateClaimCode(): string {
  return `CLAIM-${chunk(4)}-${chunk(4)}`;
}
