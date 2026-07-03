// SHA-256 helper. Fórmula obligatoria: sha256( secret || pepper )
// Debe coincidir bit a bit con la usada en supabase/seed.sql.

export async function pepperedHash(secret: string, pepper: string): Promise<string> {
  const data = new TextEncoder().encode(secret + pepper);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function getPepper(): string {
  const p = Deno.env.get("TINTAMAP_PEPPER");
  if (!p) throw new Error("TINTAMAP_PEPPER no configurado");
  return p;
}
