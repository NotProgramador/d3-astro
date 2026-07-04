// send-credential-email
// Envía un correo al perfil del explorador con:
//   - public_id
//   - fecha de creación
//   - progreso resumido
//   - recovery_code (si el cliente lo pasa desde su localStorage)
//   - claim_code + nombre de recompensa (si aplica y el cliente lo pide)
//
// Reglas duras:
//   - NUNCA crea perfil ni claim. Sólo lee.
//   - NUNCA loguea la anon key ni el pepper.
//   - El correo se resuelve por device_token → explorer_profiles.email.
//   - Si el perfil no tiene email → responde error controlado.
//   - Si RESEND_API_KEY no está seteado → guarda en email_outbox con
//     status='skipped' y responde ok con delivery:'queued', para que
//     la UX pueda mostrar un mensaje neutral sin traza técnica.
//   - Marca credential_emailed_at cuando se envía el resumen y
//     claim_emailed_at para cada claim incluido.

import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { getPepper, pepperedHash } from "../_shared/hash.ts";
import { supabaseAdmin } from "../_shared/db.ts";
import { getProfileClaims } from "../_shared/rewards.ts";
import { maskEmail } from "../_shared/mask.ts";

interface Body {
  device_token?: string;
  mode?: "credential" | "claim";       // credential = resumen completo; claim = solo claim_code
  include_recovery?: boolean;          // incluir recovery_code que pasa el cliente
  recovery_code?: string;              // sólo se usa si include_recovery=true (nunca se guarda)
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
  if (!deviceToken || deviceToken.length > 128) {
    return jsonResponse(req, { ok: false, error: "missing_device_token" }, 400);
  }
  const mode = body.mode === "claim" ? "claim" : "credential";
  const includeRecovery = !!body.include_recovery;
  const clientRecoveryCode = (body.recovery_code ?? "").trim();

  try {
    const pepper = getPepper();
    const db = supabaseAdmin;
    const deviceTokenHash = await pepperedHash(deviceToken, pepper);

    // 1. Resolver perfil
    const { data: dev } = await db
      .from("explorer_devices")
      .select("profile_id, revoked_at")
      .eq("device_token_hash", deviceTokenHash)
      .maybeSingle();
    if (!dev || dev.revoked_at) {
      return jsonResponse(req, { ok: false, error: "no_profile" }, 400);
    }
    const profileId = dev.profile_id as string;

    const { data: profile } = await db
      .from("explorer_profiles")
      .select("id, public_id, email, email_verified, created_at, credential_emailed_at")
      .eq("id", profileId)
      .maybeSingle();
    if (!profile) return jsonResponse(req, { ok: false, error: "no_profile" }, 400);
    if (!profile.email) {
      return jsonResponse(req, {
        ok: false,
        kind: "needs_email",
        title: "No hay correo asociado.",
        body: "Agrega un correo de recuperación primero para poder enviarte tu credencial.",
      }, 200);
    }

    // 2. Progreso + claims para el resumen
    const claims = await getProfileClaims(db, profileId);
    const { data: discoveries } = await db
      .from("discoveries")
      .select("family_id")
      .eq("profile_id", profileId);
    const discoveredCount = discoveries?.length ?? 0;
    const familiesStarted = new Set((discoveries ?? []).map((d) => d.family_id)).size;

    // 3. Verificar que el recovery_code que el cliente envía es del perfil.
    //    Nunca lo guardamos; sólo se pasa por el cuerpo del correo.
    let recoveryCodeForEmail: string | null = null;
    if (includeRecovery && clientRecoveryCode) {
      const codeHash = await pepperedHash(clientRecoveryCode.toUpperCase(), pepper);
      const { data: match } = await db
        .from("explorer_profiles")
        .select("id")
        .eq("id", profileId)
        .eq("recovery_code_hash", codeHash)
        .maybeSingle();
      if (match) recoveryCodeForEmail = clientRecoveryCode.toUpperCase();
    }

    // 4. Componer el correo (HTML + texto)
    const siteBase = Deno.env.get("SITE_BASE_URL") ?? "https://domingosdedibujar.netlify.app";
    const credentialUrl = `${siteBase}/tinta/tintamap/credencial`;
    const isClaimMode = mode === "claim";

    // Sólo enviamos el/los claim si aplica
    const claimForClaimMode = isClaimMode ? claims[0] ?? null : null;

    const subject = isClaimMode
      ? "Tu código de recompensa · Tinta estuvo aquí"
      : "Tu credencial · Tinta estuvo aquí";

    const bodyText = buildTextEmail({
      publicId: profile.public_id,
      createdAt: profile.created_at,
      discoveredCount,
      familiesStarted,
      recoveryCode: recoveryCodeForEmail,
      claims: isClaimMode ? (claimForClaimMode ? [claimForClaimMode] : []) : claims,
      credentialUrl,
      isClaimMode,
    });
    const bodyHtml = buildHtmlEmail({
      publicId: profile.public_id,
      createdAt: profile.created_at,
      discoveredCount,
      familiesStarted,
      recoveryCode: recoveryCodeForEmail,
      claims: isClaimMode ? (claimForClaimMode ? [claimForClaimMode] : []) : claims,
      credentialUrl,
      isClaimMode,
    });

    // 5. Enviar via Resend, o encolar en email_outbox
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("RECOVERY_EMAIL_FROM") ?? "Tinta <noreply@domingosdedibujar.mx>";
    let delivery: "sent" | "queued" | "failed" = "queued";
    let lastError: string | null = null;

    // NOTA de seguridad: el `body_text` / `body_html` puede contener
    // `recovery_code` y `claim_code` en claro. NO los persistimos en
    // `email_outbox` — sólo dejamos metadatos para telemetría. El usuario
    // reintenta el envío desde la UI si algo falla; la fila del outbox NO
    // es fuente para reenvío automático.
    const outboxBase = {
      to_email: profile.email,
      subject,
      body_text: "",           // deliberadamente vacío
      body_html: null,          // idem
      kind: isClaimMode ? "claim_summary" : "credential_summary",
    };
    if (resendKey) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from,
            to: [profile.email],
            subject,
            text: bodyText,
            html: bodyHtml,
          }),
        });
        if (res.ok) {
          delivery = "sent";
        } else {
          delivery = "failed";
          lastError = `resend_${res.status}`;
          await db.from("email_outbox").insert({
            ...outboxBase,
            status: "failed",
            last_error: lastError,
          });
        }
      } catch (err) {
        delivery = "failed";
        lastError = "resend_network";
        await db.from("email_outbox").insert({
          ...outboxBase,
          status: "failed",
          last_error: String(err).slice(0, 200),
        });
      }
    } else {
      await db.from("email_outbox").insert({
        ...outboxBase,
        status: "skipped",
        last_error: "RESEND_API_KEY no configurado",
      });
    }

    // 6. Marcar timestamps sólo si el envío fue exitoso o encolado
    //    (no marcar en "failed" para que el usuario pueda reintentar).
    const now = new Date().toISOString();
    if (delivery === "sent" || (delivery === "queued" && !resendKey)) {
      if (!isClaimMode) {
        await db.from("explorer_profiles")
          .update({ credential_emailed_at: now })
          .eq("id", profileId);
      }
      if (isClaimMode && claimForClaimMode) {
        // Marcar el claim específico
        await db.from("reward_claims")
          .update({ claim_emailed_at: now })
          .eq("profile_id", profileId)
          .eq("claim_code", claimForClaimMode.claim_code);
      } else if (!isClaimMode) {
        // En modo credencial, marcamos todos los claims del perfil
        // como enviados (van dentro del mismo correo).
        for (const c of claims) {
          await db.from("reward_claims")
            .update({ claim_emailed_at: now })
            .eq("profile_id", profileId)
            .eq("claim_code", c.claim_code);
        }
      }
    }

    // 7. Respuesta amigable
    return jsonResponse(req, {
      ok: true,
      delivery,
      to_masked: maskEmail(profile.email),
      credential_emailed_at: !isClaimMode ? now : profile.credential_emailed_at,
      claim_emailed_at: isClaimMode ? now : null,
      last_error: lastError,
    });
  } catch (e) {
    console.error("send-credential-email error", e);
    return jsonResponse(req, {
      ok: false,
      kind: "neutral",
      title: "No pudimos enviar el correo.",
      body: "Intenta de nuevo más tarde.",
    }, 200);
  }
});

function buildTextEmail(opts: {
  publicId: string;
  createdAt: string;
  discoveredCount: number;
  familiesStarted: number;
  recoveryCode: string | null;
  claims: Array<{ claim_code: string; reward_name: string; family_name: string | null }>;
  credentialUrl: string;
  isClaimMode: boolean;
}): string {
  const created = new Date(opts.createdAt).toLocaleDateString();
  const lines: string[] = [];
  if (opts.isClaimMode) {
    lines.push("Tu código de recompensa — Tinta estuvo aquí");
    lines.push("");
    for (const c of opts.claims) {
      lines.push(`Recompensa: ${c.reward_name}`);
      lines.push(`Familia:    ${c.family_name ?? ""}`);
      lines.push(`Código:     ${c.claim_code}`);
      lines.push("");
    }
    lines.push("Guarda este código. Podrás presentarlo cuando se anuncie el punto de entrega.");
  } else {
    lines.push("Tu credencial — Tinta estuvo aquí");
    lines.push("");
    lines.push(`ID público:              ${opts.publicId}`);
    lines.push(`Fecha de unión:          ${created}`);
    lines.push(`Nodos encontrados:       ${opts.discoveredCount}`);
    lines.push(`Familias iniciadas:      ${opts.familiesStarted}`);
    if (opts.recoveryCode) {
      lines.push(`Código de recuperación:  ${opts.recoveryCode}`);
    }
    if (opts.claims.length > 0) {
      lines.push("");
      lines.push("Recompensas desbloqueadas:");
      for (const c of opts.claims) {
        lines.push(`  - ${c.reward_name} · ${c.claim_code}`);
      }
    }
  }
  lines.push("");
  lines.push(`Tu credencial en línea: ${opts.credentialUrl}`);
  lines.push("");
  lines.push("Domingos de Dibujar · Tinta estuvo aquí");
  return lines.join("\n");
}

function buildHtmlEmail(opts: {
  publicId: string;
  createdAt: string;
  discoveredCount: number;
  familiesStarted: number;
  recoveryCode: string | null;
  claims: Array<{ claim_code: string; reward_name: string; family_name: string | null }>;
  credentialUrl: string;
  isClaimMode: boolean;
}): string {
  const created = new Date(opts.createdAt).toLocaleDateString();
  const esc = (s: string) => s.replace(/[<>&"']/g, (c) =>
    ({ "<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&#39;" } as any)[c]);
  const rewardsBlock = opts.claims.map((c) => `
    <tr><td style="padding:12px 0;border-bottom:1px dashed rgba(17,17,17,.18)">
      <div style="font-family:Georgia,serif;font-size:16px;font-weight:700">${esc(c.reward_name)}</div>
      <div style="color:#544c45;font-size:13px">${esc(c.family_name ?? "")}</div>
      <div style="margin-top:6px;font-family:Georgia,serif;color:#d9485f;font-size:18px;letter-spacing:.03em">${esc(c.claim_code)}</div>
    </td></tr>`).join("");

  const bodyRows = opts.isClaimMode ? "" : `
    <tr><td style="padding:6px 0;color:#544c45;text-transform:uppercase;letter-spacing:.08em;font-size:11px">ID público</td>
        <td style="text-align:right;font-family:Georgia,serif;font-size:16px">${esc(opts.publicId)}</td></tr>
    <tr><td style="padding:6px 0;color:#544c45;text-transform:uppercase;letter-spacing:.08em;font-size:11px">Fecha de unión</td>
        <td style="text-align:right;font-family:Georgia,serif;font-size:16px">${esc(created)}</td></tr>
    <tr><td style="padding:6px 0;color:#544c45;text-transform:uppercase;letter-spacing:.08em;font-size:11px">Nodos encontrados</td>
        <td style="text-align:right;font-family:Georgia,serif;font-size:16px">${opts.discoveredCount}</td></tr>
    <tr><td style="padding:6px 0;color:#544c45;text-transform:uppercase;letter-spacing:.08em;font-size:11px">Familias iniciadas</td>
        <td style="text-align:right;font-family:Georgia,serif;font-size:16px">${opts.familiesStarted}</td></tr>
    ${opts.recoveryCode ? `
    <tr><td style="padding:6px 0;color:#544c45;text-transform:uppercase;letter-spacing:.08em;font-size:11px">Código de recuperación</td>
        <td style="text-align:right;font-family:Georgia,serif;font-size:16px;color:#d9485f">${esc(opts.recoveryCode)}</td></tr>` : ""}
  `;

  return `<!doctype html><html><body style="margin:0;background:#f4f1ea;font-family:'Helvetica Neue',Arial,sans-serif;color:#171411">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;padding:24px">
      <tr><td>
        <p style="margin:0;font-family:'Trebuchet MS',sans-serif;text-transform:uppercase;letter-spacing:.1em;font-size:12px;color:#d9485f;font-weight:700">${opts.isClaimMode ? "recompensa desbloqueada" : "tinta estuvo aquí"}</p>
        <h1 style="margin:6px 0 24px;font-family:Georgia,serif;font-size:28px;line-height:1.1">${opts.isClaimMode ? "Tu código de reclamo" : "Tu credencial de explorador"}</h1>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="background:rgba(255,255,255,.6);border:1.5px solid rgba(17,17,17,.82);padding:16px 20px">
          ${bodyRows}
          ${!opts.isClaimMode && opts.claims.length > 0 ? `
            <tr><td colspan="2" style="padding-top:16px">
              <p style="margin:0;color:#544c45;text-transform:uppercase;letter-spacing:.08em;font-size:11px">Recompensas desbloqueadas</p>
              <table role="presentation" width="100%">${rewardsBlock}</table>
            </td></tr>` : ""}
          ${opts.isClaimMode ? `<tr><td colspan="2"><table role="presentation" width="100%">${rewardsBlock}</table></td></tr>` : ""}
        </table>
        <p style="margin:20px 0 0;font-size:14px;line-height:1.6">
          Guarda este correo. Puedes ver tu credencial en línea aquí:<br>
          <a href="${opts.credentialUrl}" style="color:#171411">${esc(opts.credentialUrl)}</a>
        </p>
        <p style="margin:24px 0 0;font-family:Georgia,serif;font-style:italic;color:#544c45;font-size:13px">
          Domingos de Dibujar · Tinta estuvo aquí
        </p>
      </td></tr>
    </table></body></html>`;
}
