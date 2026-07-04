// create-explorer
// Dos usos:
//   1. Crear explícitamente un perfil vacío (para /credencial cuando el
//      visitante clic "Crear mi credencial" y aún no ha escaneado un nodo).
//   2. Con { probe: true }: SÓLO devuelve el perfil existente vinculado al
//      device_token. Nunca crea. Sirve al frontend para hidratar estado
//      desde el backend en cada carga sin duplicar perfiles.
//
// El backend es la fuente de verdad del estado de recuperación de correo;
// esta función devuelve masked_email/recovery_status/preferences cuando ya
// existe el perfil, para que el frontend no dependa de localStorage.

import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { getPepper, pepperedHash } from "../_shared/hash.ts";
import { generatePublicId, generateRecoveryCode } from "../_shared/ids.ts";
import { supabaseAdmin } from "../_shared/db.ts";
import { computeProgress } from "../_shared/progress.ts";
import { maskEmail, computeRecoveryStatus } from "../_shared/mask.ts";
import { getProfileClaims } from "../_shared/rewards.ts";

interface Body {
  device_token?: string;
  probe?: boolean;
}

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== "POST") {
    return jsonResponse(req, { ok: false, error: "method_not_allowed" }, 405);
  }

  let body: Body;
  try { body = await req.json(); }
  catch { return jsonResponse(req, { ok: false, error: "invalid_json" }, 400); }

  const deviceToken = (body.device_token ?? "").trim();
  const probe = !!body.probe;
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

    // Rama 1: perfil existente vinculado a este device (activo).
    if (existingDev && !existingDev.revoked_at) {
      const state = await loadProfileState(db, existingDev.profile_id as string);
      return jsonResponse(req, {
        ok: true,
        already_exists: true,
        ...state,
      });
    }

    // Rama 2: probe → no crear, sólo reportar ausencia.
    if (probe) {
      return jsonResponse(req, {
        ok: true,
        already_exists: false,
        profile: null,
        progress: null,
        has_recovery_email: false,
        masked_email: null,
        email_verified: false,
        recovery_status: "none",
        preferences: null,
        claims: [],
      });
    }

    // Rama 3: crear perfil nuevo con credenciales.
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
      // Perfil recién creado: nunca tiene correo aún.
      has_recovery_email: false,
      masked_email: null,
      email_verified: false,
      recovery_status: "none",
      preferences: null,
      claims: [],
    });
  } catch (e) {
    console.error("create-explorer error", e);
    return jsonResponse(req, { ok: false, error: "internal" }, 500);
  }
});

async function loadProfileState(db: typeof supabaseAdmin, profileId: string) {
  const { data: prof } = await db
    .from("explorer_profiles")
    .select("id, public_id, created_at, email, email_verified, credential_emailed_at")
    .eq("id", profileId)
    .maybeSingle();
  if (!prof) {
    return {
      profile: null,
      progress: null,
      has_recovery_email: false,
      masked_email: null,
      email_verified: false,
      recovery_status: "none" as const,
      preferences: null,
      claims: [],
    };
  }
  const { data: prefsRow } = await db
    .from("email_preferences")
    .select("recovery_emails, clue_emails, event_emails, project_news")
    .eq("profile_id", profileId)
    .maybeSingle();
  return {
    profile: { public_id: prof.public_id, created_at: prof.created_at },
    progress: await computeProgress(db, profileId),
    has_recovery_email: !!prof.email,
    masked_email: maskEmail(prof.email),
    email_verified: !!prof.email_verified,
    recovery_status: computeRecoveryStatus(prof.email, prof.email_verified),
    preferences: prefsRow ?? null,
    claims: await getProfileClaims(db, profileId),
    credential_emailed_at: prof.credential_emailed_at ?? null,
  };
}
