// attach-recovery-email
// Asocia un correo (opcional) al perfil ya existente identificado por
// el device_token. Reglas duras:
//   - NUNCA crea un explorer_profile (sólo UPDATE).
//   - Reinicia email_verified a false si el correo cambia.
//   - Rechaza si otro perfil ya tiene ese correo.
//   - Upsert de email_preferences con conflicto en profile_id (nunca duplica).
//   - Normaliza email a trim+lowercase.
//   - Devuelve el estado completo de recuperación para que el frontend
//     hidrate sin depender de localStorage.

import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { getPepper, pepperedHash } from "../_shared/hash.ts";
import { supabaseAdmin } from "../_shared/db.ts";
import { maskEmail, computeRecoveryStatus } from "../_shared/mask.ts";

interface Body {
  device_token?: string;
  email?: string;
  prefs?: {
    clue_emails?: boolean;
    event_emails?: boolean;
    project_news?: boolean;
  };
  confirm_replace?: boolean;
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
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
  const email = (body.email ?? "").trim().toLowerCase();
  if (!deviceToken || !isValidEmail(email)) {
    return jsonResponse(req, { ok: false, error: "invalid_input" }, 400);
  }

  try {
    const pepper = getPepper();
    const db = supabaseAdmin;
    const deviceTokenHash = await pepperedHash(deviceToken, pepper);

    // 1. Resolver el perfil vía device_token — nunca creamos aquí.
    const { data: dev } = await db
      .from("explorer_devices")
      .select("profile_id, revoked_at")
      .eq("device_token_hash", deviceTokenHash)
      .maybeSingle();
    if (!dev || dev.revoked_at) {
      return jsonResponse(req, { ok: false, error: "no_profile" }, 400);
    }

    // 2. Estado actual del perfil.
    const { data: profile } = await db
      .from("explorer_profiles")
      .select("id, email, email_verified")
      .eq("id", dev.profile_id)
      .maybeSingle();
    if (!profile) {
      return jsonResponse(req, { ok: false, error: "no_profile" }, 400);
    }

    const emailChanged = (profile.email ?? "") !== email;

    // 3. Regla 7: si cambia el correo, exigir confirm_replace explícito.
    if (profile.email && emailChanged && !body.confirm_replace) {
      return jsonResponse(req, {
        ok: false,
        kind: "needs_confirmation",
        title: "¿Reemplazar el correo de recuperación?",
        body: "Tu credencial ya tiene un correo asociado. Si lo cambias, tendrás que volver a confirmar el nuevo.",
      }, 200);
    }

    // 4. Regla dura: prohibir asociar un correo que ya usa otro perfil.
    if (emailChanged) {
      const { data: clash } = await db
        .from("explorer_profiles")
        .select("id")
        .eq("email", email)
        .neq("id", profile.id)
        .maybeSingle();
      if (clash) {
        return jsonResponse(req, {
          ok: false,
          kind: "neutral",
          title: "No pudimos guardar este correo.",
          body: "Prueba con otro correo o recupera tu credencial existente.",
        }, 200);
      }
    }

    // 5. UPDATE (nunca INSERT). Si el correo cambia, verified vuelve a false.
    const newVerified = emailChanged ? false : !!profile.email_verified;
    await db.from("explorer_profiles")
      .update({
        email,
        email_verified: newVerified,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    // 6. Preferencias: upsert con conflicto en profile_id (jamás duplica).
    const prefs = body.prefs ?? {};
    await db.from("email_preferences").upsert({
      profile_id: profile.id,
      recovery_emails: true,
      clue_emails: !!prefs.clue_emails,
      event_emails: !!prefs.event_emails,
      project_news: !!prefs.project_news,
      consented_at: new Date().toISOString(),
    }, { onConflict: "profile_id" });

    // 7. Confirmación por correo (Resend si hay key; si no, encolar).
    if (emailChanged) {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      const from = Deno.env.get("RECOVERY_EMAIL_FROM") ?? "Tinta <noreply@example.com>";
      const subject = "Tu credencial de Tinta estuvo aquí";
      const bodyText =
        "Guardamos este correo asociado a tu credencial de exploración.\n" +
        "Nunca te enviaremos publicidad. Sólo podremos ayudarte a recuperar tu recorrido.\n";
      if (resendKey) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
            body: JSON.stringify({ from, to: [email], subject, text: bodyText }),
          });
        } catch (err) {
          console.warn("Resend error, dejando en outbox", err);
          await db.from("email_outbox").insert({
            to_email: email, subject, body_text: bodyText, kind: "attach_confirmation",
          });
        }
      } else {
        await db.from("email_outbox").insert({
          to_email: email, subject, body_text: bodyText, kind: "attach_confirmation",
          status: "skipped", last_error: "SMTP no configurado",
        });
      }
    }

    // 8. Devolver estado normalizado que el frontend usa como fuente de verdad.
    return jsonResponse(req, {
      ok: true,
      email_saved: true,
      changed: emailChanged,
      has_recovery_email: true,
      masked_email: maskEmail(email),
      email_verified: newVerified,
      recovery_status: computeRecoveryStatus(email, newVerified),
    });
  } catch (e) {
    console.error("attach-recovery-email error", e);
    return jsonResponse(req, { ok: false, error: "internal" }, 500);
  }
});
