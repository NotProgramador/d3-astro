// recover-by-code
// Vincula el device actual a un perfil existente usando el recovery_code.
// Rate-limit: máx. 8 intentos por identificador (hash) en la última hora.

import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { getPepper, pepperedHash } from "../_shared/hash.ts";
import { supabaseAdmin } from "../_shared/db.ts";
import { computeProgress } from "../_shared/progress.ts";
import { maskEmail, computeRecoveryStatus } from "../_shared/mask.ts";
import { getProfileClaims } from "../_shared/rewards.ts";

const NEUTRAL_INVALID = {
  ok: false,
  kind: "neutral",
  title: "No pudimos recuperar esta credencial.",
  body: "Verifica el código. Si sigues sin encontrarlo, tal vez fue creado en otro dispositivo o hay una letra distinta.",
};

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== "POST") {
    return jsonResponse(req, { ok: false, error: "method_not_allowed" }, 405);
  }

  let body: { recovery_code?: string; device_token?: string };
  try { body = await req.json(); }
  catch { return jsonResponse(req, { ok: false, error: "invalid_json" }, 400); }

  const code = (body.recovery_code ?? "").trim().toUpperCase();
  const deviceToken = (body.device_token ?? "").trim();

  if (!code || code.length > 64 || !deviceToken || deviceToken.length > 128) {
    return jsonResponse(req, NEUTRAL_INVALID, 200);
  }

  try {
    const pepper = getPepper();
    const db = supabaseAdmin;

    const codeHash = await pepperedHash(code, pepper);
    const deviceTokenHash = await pepperedHash(deviceToken, pepper);

    // Rate limit ligero
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await db
      .from("recovery_attempts")
      .select("id", { count: "exact", head: true })
      .eq("identifier", codeHash)
      .gte("created_at", oneHourAgo);

    if ((count ?? 0) >= 8) {
      return jsonResponse(req, {
        ok: false,
        kind: "neutral",
        title: "Muchos intentos.",
        body: "Espera un rato antes de volver a intentarlo.",
      }, 200);
    }

    const { data: profile } = await db
      .from("explorer_profiles")
      .select("id, public_id, created_at, email, email_verified")
      .eq("recovery_code_hash", codeHash)
      .maybeSingle();

    await db.from("recovery_attempts").insert({
      identifier: codeHash,
      succeeded: !!profile,
    });

    if (!profile) return jsonResponse(req, NEUTRAL_INVALID, 200);

    // Vincular device actual (idempotente).
    const { data: existingDev } = await db
      .from("explorer_devices")
      .select("id, profile_id, revoked_at")
      .eq("device_token_hash", deviceTokenHash)
      .maybeSingle();

    if (existingDev) {
      // Reasignar la fila existente al perfil recuperado. Nunca insertar
      // una fila nueva con el mismo device_token_hash (unique constraint).
      await db.from("explorer_devices").update({
        profile_id: profile.id,
        revoked_at: null,
        last_seen_at: new Date().toISOString(),
      }).eq("id", existingDev.id);
    } else {
      await db.from("explorer_devices").insert({
        profile_id: profile.id,
        device_token_hash: deviceTokenHash,
      });
    }

    // Traer preferencias (si el perfil las tiene). Nunca creamos filas aquí.
    const { data: prefsRow } = await db
      .from("email_preferences")
      .select("recovery_emails, clue_emails, event_emails, project_news")
      .eq("profile_id", profile.id)
      .maybeSingle();

    return jsonResponse(req, {
      ok: true,
      profile: { public_id: profile.public_id, created_at: profile.created_at },
      progress: await computeProgress(db, profile.id),
      has_recovery_email: !!profile.email,
      masked_email: maskEmail(profile.email),
      email_verified: !!profile.email_verified,
      recovery_status: computeRecoveryStatus(profile.email, profile.email_verified),
      preferences: prefsRow ?? null,
      // Cierre de loop: las claims existentes del perfil se devuelven
      // sin crear ni tocar reward_claims (idempotente al recuperar).
      claims: await getProfileClaims(db, profile.id),
    });
  } catch (e) {
    console.error("recover-by-code error", e);
    return jsonResponse(req, NEUTRAL_INVALID, 200);
  }
});
