/**
 * Custom Resend magic-link email — modern SaaS edition.
 *
 * Minimal, airy, and premium. Whitespaced card on a soft slate field,
 * tight typography, near-black CTA, lime accent hairline.
 * Fully table-based for Outlook/Gmail compatibility, inline-styled.
 *
 * Used by lib/auth.ts via `sendVerificationRequest`.
 */

const RESEND_API_URL = "https://api.resend.com/emails";

export async function sendVerificationRequest(params: {
  identifier: string;
  url: string;
  provider: { apiKey?: string; from?: string };
  theme?: { brandColor?: string; buttonText?: string };
}) {
  const { identifier: to, provider, url } = params;
  const { host } = new URL(url);

  const apiKey = provider.apiKey;
  if (!apiKey) {
    console.error("[magic-link-email] No RESEND_API_KEY configured — skipping send");
    return;
  }

  const from = provider.from ?? "OpenInstaDM <login@example.com>";

  const html = buildHtml({ url, host });
  const text = buildText({ url, host });

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject: `Sign in to ${host}`, html, text }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`[magic-link-email] Resend error: ${JSON.stringify(body)}`);
  }
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildHtml(params: { url: string; host: string }) {
  const { url, host } = params;
  const safeHost = escapeHtml(host);
  const safeUrl = escapeHtml(url);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <title>Sign in to ${safeHost}</title>
  <!--[if mso]><style>table{border-collapse:collapse;} a{text-decoration:none;}</style><![endif]-->
  <style>
    @media only screen and (max-width: 520px) {
      .card-pad { padding: 28px 22px 32px !important; }
      .outer-pad { padding: 24px 12px !important; }
      .h1 { font-size: 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f8fafb;">
  <!-- Preheader (hidden preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;visibility:hidden;mso-hide:all;">
    Your secure sign-in link for ${safeHost} — expires in 24 hours.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafb;">
    <tr>
      <td align="center" class="outer-pad" style="padding:40px 16px;">

        <!-- Card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
          <!-- Lime hairline -->
          <tr>
            <td style="height:3px;line-height:3px;background-color:#A2EA49;font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td class="card-pad" style="padding:36px 32px 32px;">

              <!-- Brand -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="width:36px;height:36px;background-color:#0a0a0a;border-radius:10px;text-align:center;vertical-align:middle;">
                    <span style="display:block;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:800;letter-spacing:-0.04em;color:#ffffff;line-height:36px;">O</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13.5px;font-weight:700;letter-spacing:-0.02em;color:#0f172a;">OpenInstaDM</span>
                    <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:500;letter-spacing:0.04em;color:#94a3b8;margin-left:8px;vertical-align:middle;">SIGN IN</span>
                  </td>
                </tr>
              </table>

              <!-- Heading -->
              <h1 class="h1" style="margin:0 0 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;letter-spacing:-0.03em;line-height:1.25;color:#0f172a;">
                Sign in to ${safeHost}
              </h1>
              <p style="margin:0 0 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.65;color:#64748b;">
                Click the button below to securely sign in. This magic link expires in <span style="color:#0f172a;font-weight:600;">24 hours</span> and can only be used once.
              </p>

              <!-- CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
                <tr>
                  <td style="border-radius:10px;background-color:#0a0a0a;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${safeUrl}" style="height:44px;v-text-anchor:middle;width:220px;" arcsize="22%" fillcolor="#0a0a0a" stroke="f">
                      <center style="color:#ffffff;font-family:sans-serif;font-size:14px;font-weight:600;">Sign in to your account →</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${safeUrl}" target="_blank" rel="noopener noreferrer"
                       style="display:inline-block;padding:13px 26px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;letter-spacing:-0.01em;color:#ffffff;text-decoration:none;line-height:18px;">
                      Sign in to your account&nbsp;&nbsp;→
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <!-- Security note -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="vertical-align:top;padding-top:2px;">
                    <span style="display:inline-block;width:20px;height:20px;border-radius:9999px;background-color:#f1f5f9;text-align:center;line-height:20px;font-size:11px;">🔒</span>
                  </td>
                  <td style="padding-left:8px;">
                    <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12.5px;line-height:1.55;color:#94a3b8;">
                      If you didn't request this email, you can safely ignore it. No account changes were made.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
                <tr><td style="height:1px;background-color:#f1f5f9;line-height:1px;font-size:0;">&nbsp;</td></tr>
              </table>

              <!-- Fallback -->
              <p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#94a3b8;">
                Button not working?
              </p>
              <p style="margin:0 0 6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#64748b;">
                Copy and paste this link into your browser:
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafb;border:1px solid #e2e8f0;border-radius:8px;">
                <tr>
                  <td style="padding:10px 12px;word-break:break-all;">
                    <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;font-size:11px;line-height:1.6;color:#334155;text-decoration:none;word-break:break-all;">${safeUrl}</a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>
        <!-- /Card -->

        <!-- Footer -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
          <tr>
            <td style="padding:22px 8px 0;text-align:center;">
              <p style="margin:0 0 6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#94a3b8;">
                Sent by <span style="color:#64748b;font-weight:600;">OpenInstaDM</span> — Instagram comment-to-DM automation
              </p>
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#cbd5e1;">
                This is an automated message, please do not reply.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/*  Plain-text fallback                                                */
/* ------------------------------------------------------------------ */

function buildText(params: { url: string; host: string }) {
  return [
    `Sign in to ${params.host}`,
    ``,
    `Click the link below to securely sign in (valid for 24 hours, single use):`,
    ``,
    params.url,
    ``,
    `If you didn't request this email you can safely ignore it.`,
    ``,
    `— OpenInstaDM`,
  ].join("\n");
}
