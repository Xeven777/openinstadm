/**
 * Custom Resend magic-link email template.
 *
 * The default Auth.js template is functional but plain. This version matches
 * the OpenInstaDM brand: lime-green accent, Inter-style system font stack,
 * dark-mode-aware background, and a polished CTA button.
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
  const { identifier: to, provider, url, theme } = params;
  const { host } = new URL(url);

  const apiKey = provider.apiKey;
  if (!apiKey) {
    console.error("[magic-link-email] No RESEND_API_KEY configured — skipping send");
    return;
  }

  const from = provider.from ?? "OpenInstaDM <login@example.com>";
  const brandColor = theme?.brandColor ?? "#5a8a0a";
  const buttonText = theme?.buttonText ?? "#ffffff";

  const html = buildHtml({ url, host, brandColor, buttonText });
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


function buildHtml(params: {
  url: string;
  host: string;
  brandColor: string;
  buttonText: string;
}) {
  const { url, host, brandColor, buttonText } = params;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sign in to ${host}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:48px 16px;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px 0 rgba(0,0,0,0.06),0 1px 2px -1px rgba(0,0,0,0.06);">

          <!-- Green accent bar -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg, #83BE3C 0%, #5a8a0a 100%);"></td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 36px 48px;">

              <!-- Logo mark -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="background-color:${brandColor};width:36px;height:36px;border-radius:10px;text-align:center;vertical-align:middle;font-size:18px;font-weight:700;color:${buttonText};">
                    O
                  </td>
                  <td style="padding-left:10px;font-size:16px;font-weight:700;color:#18181b;letter-spacing:-0.01em;">
                    OpenInstaDM
                  </td>
                </tr>
              </table>

              <!-- Heading -->
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;line-height:1.3;">
                Sign in to ${host}
              </h1>
              <p style="margin:0 0 28px;font-size:14px;line-height:1.65;color:#71717a;">
                Click the button below to securely sign in to your account. This link expires in <strong>24 hours</strong>.
              </p>

              <!-- CTA button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td align="center" style="border-radius:10px;background-color:${brandColor};">
                    <a href="${url}"
                       target="_blank"
                       style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:${buttonText};text-decoration:none;letter-spacing:0.01em;">
                      Sign in to your account &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="border-top:1px solid #e4e4e7;"></td>
                </tr>
              </table>

              <!-- Fallback link -->
              <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:#a1a1aa;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin:0;font-size:12px;line-height:1.6;word-break:break-all;">
                <a href="${url}" style="color:${brandColor};text-decoration:underline;text-underline-offset:2px;">${url}</a>
              </p>

            </td>
          </tr>
        </table>
        <!-- /Card -->

        <!-- Footer -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
          <tr>
            <td style="padding:20px 8px 0;text-align:center;">
              <p style="margin:0;font-size:11px;line-height:1.6;color:#a1a1aa;">
                You received this email because someone tried to sign in to your OpenInstaDM account.
                If you didn't request this, you can safely ignore this email.
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
    `Click the link below to sign in (valid for 24 hours):`,
    ``,
    params.url,
    ``,
    `If you didn't request this, you can safely ignore this email.`,
  ].join("\n");
}
