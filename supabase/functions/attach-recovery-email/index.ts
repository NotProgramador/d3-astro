// attach-recovery-email
// Asocia un correo (opcional) al perfil vinculado con el device_token.
// Guarda preferencias; nunca marca nada consentido por defecto.
// Si Resend está configurado, envía correo de confirmación; si no,
// deja el correo en `email_outbox` con status pending.

import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { getPepper, pepperedHash } from "../_shared/hash.ts";
import { supabaseAdmin } from "../_shared/db.ts";

interface Body {
  device_token?: string;
  email?: string;
  prefs?: {
    clue_emails?: boolean;
    event_emails?: boolean;
    project_news?: boolean;
  };
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

    const { data: dev } = await db
      .from("explorer_devices")
      .select("profile_id, revoked_at")
      .eq("device_token_hash", deviceTokenHash)
      .maybeSingle();
    if (!dev || dev.revoked_at) {
      return jsonResponse(req, { ok: false, error: "no_profile" }, 400);
    }

    await db.from("explorer_profiles")
      .update({ email, updated_at: new Date().toISOString() })
      .eq("id", dev.profile_id);

    const prefs = body.prefs ?? {};
    await db.from("email_preferences").upsert({
      profile_id: dev.profile_id,
      recovery_emails: true,
      clue_emails: !!prefs.clue_emails,
      event_emails: !!prefs.event_emails,
      project_news: !!prefs.project_news,
      consented_at: new Date().toISOString(),
    }, { onConflict: "profile_id" });

    // Enviar correo de confirmación si Resend está configurado.
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
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${resendKey}`,
          },
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

    return jsonResponse(req, { ok: true, email_saved: true, delivery: resendKey ? "sent" : "queued" });
  } catch (e) {
    console.error("attach-recovery-email error", e);
    return jsonResponse(req, { ok: false, error: "internal" }, 500);
  }
});
