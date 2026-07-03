// rotate-node-key (admin)
// Rota la access_key_hash de un placement sin borrar su historial.
// Requiere un secreto compartido en el header x-admin-secret que debe
// coincidir con la variable de entorno TINTAMAP_ADMIN_SECRET.
//
// Devuelve el NUEVO token en texto plano en la respuesta (una sola vez).
// Guardar inmediatamente en el gestor de secretos del proyecto físico.

import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { getPepper, pepperedHash } from "../_shared/hash.ts";
import { supabaseAdmin } from "../_shared/db.ts";

function generateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== "POST") {
    return jsonResponse(req, { ok: false, error: "method_not_allowed" }, 405);
  }

  const adminSecret = Deno.env.get("TINTAMAP_ADMIN_SECRET");
  const provided = req.headers.get("x-admin-secret");
  if (!adminSecret || provided !== adminSecret) {
    return jsonResponse(req, { ok: false, error: "unauthorized" }, 401);
  }

  let body: { placement_id?: string };
  try { body = await req.json(); }
  catch { return jsonResponse(req, { ok: false, error: "invalid_json" }, 400); }

  const placementId = (body.placement_id ?? "").trim();
  if (!placementId) return jsonResponse(req, { ok: false, error: "missing_placement_id" }, 400);

  try {
    const pepper = getPepper();
    const db = supabaseAdmin;
    const newToken = generateToken();
    const newHash = await pepperedHash(newToken, pepper);

    const { data, error } = await db
      .from("node_placements")
      .update({ access_key_hash: newHash, last_checked_at: new Date().toISOString() })
      .eq("id", placementId)
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("not_found");

    return jsonResponse(req, {
      ok: true,
      placement_id: placementId,
      new_token: newToken, // guarda esto una sola vez
    });
  } catch (e) {
    console.error("rotate-node-key error", e);
    return jsonResponse(req, { ok: false, error: "internal" }, 500);
  }
});
