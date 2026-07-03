// send-recovery-email
// Reenvía el recovery_code al correo asociado.
// SIEMPRE responde neutralmente para no confirmar/negar existencia.
// Si SMTP no está listo, se guarda en email_outbox con status skipped.
//
// NOTA: el recovery_code sólo se puede obtener de dos formas:
//   1. El usuario lo guardó al crear la credencial.
//   2. El usuario lo asocia con un correo y perdió el código local.
// En (2) el código real no puede recomputarse (guardamos hash), así
// que enviamos un enlace/código de "vincular device" nuevo sin
// exponer el recovery_code original.
//
// Como en esta sesión NO tenemos un flujo completo de magic-link,
// enviamos un mensaje editorial explicando que se generará un
// código temporal en la próxima sesión. La función queda con
// estructura lista para intercambiar por magic-link real.

import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/db.ts";

const NEUTRAL = {
  ok: true,
  kind: "neutral",
  message: "Si encontramos una credencial asociada, recibirás un correo.",
};

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  if (req.method !== "POST") {
    return jsonResponse(req, { ok: false, error: "method_not_allowed" }, 405);
  }

  let body: { email?: string };
  try { body = await req.json(); }
  catch { return jsonResponse(req, NEUTRAL, 200); }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!isValidEmail(email)) return jsonResponse(req, NEUTRAL, 200);

  try {
    const db = supabaseAdmin;
    const { data: profile } = await db
      .from("explorer_profiles")
      .select("id, public_id")
      .eq("email", email)
      .maybeSingle();

    const subject = "Recuperar tu credencial de Tinta";
    const bodyText =
      "Alguien pidió recuperar la credencial asociada a este correo.\n\n" +
      "En breve activaremos el flujo completo de recuperación por correo. " +
      "Mientras tanto, si conservas tu código de recuperación (formato D3-XXXX-XXXX-XXXX), " +
      "puedes usarlo directamente en la página 'Recuperar mi credencial'.\n\n" +
      "Si no pediste esto, ignora este correo.";

    if (profile) {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      const from = Deno.env.get("RECOVERY_EMAIL_FROM") ?? "Tinta <noreply@example.com>";
      if (resendKey) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
            body: JSON.stringify({ from, to: [email], subject, text: bodyText }),
          });
        } catch (err) {
          console.warn("Resend fail, encolando", err);
          await db.from("email_outbox").insert({
            to_email: email, subject, body_text: bodyText, kind: "recovery_request",
          });
        }
      } else {
        await db.from("email_outbox").insert({
          to_email: email, subject, body_text: bodyText, kind: "recovery_request",
          status: "skipped", last_error: "SMTP no configurado",
        });
      }
    }
    // Siempre respuesta neutral
    return jsonResponse(req, NEUTRAL, 200);
  } catch (e) {
    console.error("send-recovery-email error", e);
    return jsonResponse(req, NEUTRAL, 200);
  }
});
