// unlock-node
// Valida una key NFC opaca, registra el descubrimiento del explorador,
// crea perfil anónimo si es necesario, y devuelve contenido + progreso.
//
// Nunca devuelve tokens, hashes, ni información de otros nodos.
// Estados no-activos regresan mensaje editorial (no error técnico).

import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { getPepper, pepperedHash } from "../_shared/hash.ts";
import { generatePublicId, generateRecoveryCode } from "../_shared/ids.ts";
import { supabaseAdmin } from "../_shared/db.ts";
import { computeProgress } from "../_shared/progress.ts";
import { ensureClaimForCompletedFamily } from "../_shared/rewards.ts";

interface Body {
  token?: string;
  device_token?: string;
}

const EDITORIAL_INACTIVE = {
  ok: false,
  kind: "editorial",
  title: "Esta aparición de Tinta ya no está activa.",
  body: "Tinta dejó este lugar, pero quizá haya otra señal cerca.",
};

const EDITORIAL_NOT_FOUND = {
  ok: false,
  kind: "editorial",
  title: "No encontramos esta aparición.",
  body: "La señal no coincide con ningún dibujo escondido. Tal vez la etiqueta esté dañada.",
};

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  if (req.method !== "POST") {
    return jsonResponse(req, { ok: false, error: "method_not_allowed" }, 405);
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(req, { ok: false, error: "invalid_json" }, 400);
  }

  const token = (body.token ?? "").trim();
  const deviceToken = (body.device_token ?? "").trim();

  if (!token || token.length > 512) {
    return jsonResponse(req, EDITORIAL_NOT_FOUND, 200);
  }
  if (!deviceToken || deviceToken.length > 128) {
    return jsonResponse(req, { ok: false, error: "missing_device_token" }, 400);
  }

  try {
    const pepper = getPepper();
    const db = supabaseAdmin;

    const accessKeyHash = await pepperedHash(token, pepper);
    const deviceTokenHash = await pepperedHash(deviceToken, pepper);

    // 1. Buscar placement por hash
    const { data: placement, error: pErr } = await db
      .from("node_placements")
      .select("id, family_id, display_name, zone_name, location_hint, status, scan_count")
      .eq("access_key_hash", accessKeyHash)
      .maybeSingle();

    if (pErr) throw pErr;
    if (!placement) return jsonResponse(req, EDITORIAL_NOT_FOUND, 200);

    if (placement.status !== "active") {
      // Devolvemos siempre respuesta editorial coherente; no diferenciamos causas.
      return jsonResponse(req, EDITORIAL_INACTIVE, 200);
    }

    // 2. Obtener familia (contenido)
    const { data: family } = await db
      .from("node_families")
      .select("id, name, description, content_type, symbol, image_url, content_json, reward_json")
      .eq("id", placement.family_id)
      .maybeSingle();

    if (!family) return jsonResponse(req, EDITORIAL_INACTIVE, 200);

    // 3. Buscar/crear perfil del explorador por device_token_hash
    let profileId: string | null = null;
    let publicId: string | null = null;
    let createdCredentials: { public_id: string; recovery_code: string } | null = null;

    const { data: deviceRow } = await db
      .from("explorer_devices")
      .select("id, profile_id, revoked_at")
      .eq("device_token_hash", deviceTokenHash)
      .maybeSingle();

    if (deviceRow && !deviceRow.revoked_at) {
      profileId = deviceRow.profile_id as string;
      const { data: prof } = await db
        .from("explorer_profiles")
        .select("public_id")
        .eq("id", profileId)
        .maybeSingle();
      publicId = prof?.public_id ?? null;
      await db.from("explorer_profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", profileId);
    } else {
      // Crear perfil nuevo con credenciales.
      publicId = generatePublicId();
      const recoveryCode = generateRecoveryCode();
      const recoveryHash = await pepperedHash(recoveryCode, pepper);

      const { data: newProfile, error: profErr } = await db
        .from("explorer_profiles")
        .insert({
          public_id: publicId,
          recovery_code_hash: recoveryHash,
        })
        .select("id")
        .single();
      if (profErr || !newProfile) throw profErr ?? new Error("no_profile");
      profileId = newProfile.id as string;

      if (deviceRow) {
        // Fila revocada existente: re-asignar en vez de re-insertar
        // (device_token_hash es unique — INSERT chocaría).
        await db.from("explorer_devices").update({
          profile_id: profileId,
          revoked_at: null,
          last_seen_at: new Date().toISOString(),
        }).eq("id", deviceRow.id);
      } else {
        await db.from("explorer_devices").insert({
          profile_id: profileId,
          device_token_hash: deviceTokenHash,
        });
      }

      createdCredentials = { public_id: publicId, recovery_code: recoveryCode };
    }

    // 4. Registrar descubrimiento (upsert por par unique)
    let isFirstScan = false;
    const { data: existingDisc } = await db
      .from("discoveries")
      .select("id, scan_count")
      .eq("profile_id", profileId)
      .eq("placement_id", placement.id)
      .maybeSingle();

    if (existingDisc) {
      await db
        .from("discoveries")
        .update({
          last_scanned_at: new Date().toISOString(),
          scan_count: (existingDisc.scan_count ?? 1) + 1,
        })
        .eq("id", existingDisc.id);
    } else {
      isFirstScan = true;
      await db.from("discoveries").insert({
        profile_id: profileId,
        placement_id: placement.id,
        family_id: placement.family_id,
      });
    }

    // 5. Incrementar scan_count del placement
    await db
      .from("node_placements")
      .update({ scan_count: (placement.scan_count ?? 0) + 1 })
      .eq("id", placement.id);

    // 6. Progreso
    const progress = await computeProgress(db, profileId!);

    // 7. Cierre de loop — si la familia queda completada, garantiza un claim
    //    único. Idempotente: re-escaneos devuelven el mismo claim_code.
    const famProgress = progress.families.find(
      (f) => f.family_id === placement.family_id,
    );
    const rewardClaim = await ensureClaimForCompletedFamily(
      db,
      profileId!,
      placement.family_id,
      family.name,
      !!famProgress?.completed,
    );

    return jsonResponse(req, {
      ok: true,
      is_first_scan_of_placement: isFirstScan,
      created_credentials: createdCredentials, // sólo la primera vez
      profile: { public_id: publicId },
      placement: {
        id: placement.id,
        family_id: placement.family_id,
        display_name: placement.display_name,
        scan_count: (placement.scan_count ?? 0) + 1,
      },
      family: {
        id: family.id,
        name: family.name,
        description: family.description,
        content_type: family.content_type,
        symbol: family.symbol,
        image_url: family.image_url,
        content: family.content_json,
        reward: family.reward_json,
      },
      progress,
      reward_claim: rewardClaim,
    });
  } catch (e) {
    console.error("unlock-node error", e);
    return jsonResponse(req, {
      ok: false,
      kind: "editorial",
      title: "Algo se movió en el mundo de Tinta.",
      body: "Intenta acercarte otra vez en un momento.",
    }, 200);
  }
});
