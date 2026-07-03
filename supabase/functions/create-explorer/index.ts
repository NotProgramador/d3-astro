// create-explorer
// Crea explícitamente un perfil vacío (útil si el usuario entra a
// /credencial antes de escanear un nodo). Si el device_token ya tiene
// perfil, devuelve el existente sin recovery_code.

import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { getPepper, pepperedHash } from "../_shared/hash.ts";
import { generatePublicId, generateRecoveryCode } from "../_shared/ids.ts";
import { supabaseAdmin } from "../_shared/db.ts";
import { computeProgress } from "../_shared/progress.ts";

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== "POST") {
    return jsonResponse(req, { ok: false, error: "method_not_allowed" }, 405);
  }

  let body: { device_token?: string };
  try { body = await req.json(); }
  catch { return jsonResponse(req, { ok: false, error: "invalid_json" }, 400); }

  const deviceToken = (body.device_token ?? "").trim();
  if (!deviceToken || deviceToken.length > 128) {
    return jsonResponse(req, { ok: false, error: "missing_device_token" }, 400);
  }

  try {
    const pepper = getPepper();
    const db = supabaseAdmin;
    const deviceTokenHash = await pepperedHash(deviceToken, pepper);

    const { data: existingDev } = await db
      .from("explorer_devices")
      .select("id, profile_id, revoked_at")
      .eq("device_token_hash", deviceTokenHash)
      .maybeSingle();

    if (existingDev && !existingDev.revoked_at) {
      const { data: prof } = await db
        .from("explorer_profiles")
        .select("id, public_id, created_at")
        .eq("id", existingDev.profile_id)
        .maybeSingle();
      const progress = prof ? await computeProgress(db, prof.id) : null;
      return jsonResponse(req, {
        ok: true,
        already_exists: true,
        profile: prof ? { public_id: prof.public_id, created_at: prof.created_at } : null,
        progress,
      });
    }

    const publicId = generatePublicId();
    const recoveryCode = generateRecoveryCode();
    const recoveryHash = await pepperedHash(recoveryCode, pepper);

    const { data: newProfile, error } = await db
      .from("explorer_profiles")
      .insert({ public_id: publicId, recovery_code_hash: recoveryHash })
      .select("id, public_id, created_at")
      .single();
    if (error || !newProfile) throw error ?? new Error("no_profile");

    if (existingDev) {
      // Fila revocada: re-asignar en vez de re-insertar (unique constraint).
      await db.from("explorer_devices").update({
        profile_id: newProfile.id,
        revoked_at: null,
        last_seen_at: new Date().toISOString(),
      }).eq("id", existingDev.id);
    } else {
      await db.from("explorer_devices").insert({
        profile_id: newProfile.id,
        device_token_hash: deviceTokenHash,
      });
    }

    return jsonResponse(req, {
      ok: true,
      already_exists: false,
      profile: { public_id: newProfile.public_id, created_at: newProfile.created_at },
      credentials: { public_id: publicId, recovery_code: recoveryCode },
      progress: await computeProgress(db, newProfile.id),
    });
  } catch (e) {
    console.error("create-explorer error", e);
    return jsonResponse(req, { ok: false, error: "internal" }, 500);
  }
});
