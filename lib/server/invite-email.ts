/**
 * Invite email delivery (Resend REST API) — modern SaaS edition.
 *
 * Clean card on a soft slate canvas, generous whitespace, near-black CTA,
 * lime hairline accent. Table-based, fully inline-styled for inbox clients.
 * Sending remains best-effort: failures never block the invite mutation
 * (the inviter still gets a copyable link in the UI).
 */

const RESEND_API_URL = "https://api.resend.com/emails";

export interface InviteEmailPayload {
  to: string;
  workspaceName: string;
  inviteUrl: string;
  invitedBy: string;
}

export interface MemberAddedEmailPayload {
  to: string;
  workspaceName: string;
  signInUrl: string;
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return false;
  }

  const from = process.env.EMAIL_FROM ?? "OpenInstaDM <login@example.com>";
  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    });
    if (!res.ok) {
      console.error(
        "[invite-email] Resend error:",
        JSON.stringify(await res.json().catch(() => ({})))
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error("[invite-email] Send failed:", error);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Shared shell                                                       */
/* ------------------------------------------------------------------ */

function emailShell(opts: {
  preheader: string;
  badgeLabel: string;
  title: string;
  introHtml: string;
  cta: { label: string; url: string };
  metaLine?: string;
  fallbackHint?: string;
}) {
  const safeCtaUrl = escapeHtml(opts.cta.url);
  const safeCtaLabel = escapeHtml(opts.cta.label);
  const safeTitle = opts.title; // caller escapes dynamic parts, keeps <span> styling
  const safeMeta = opts.metaLine ? escapeHtml(opts.metaLine) : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <title>${escapeHtml(opts.title.replace(/<[^>]*>/g, ""))}</title>
  <!--[if mso]><style>table{border-collapse:collapse;}</style><![endif]-->
  <style>
    @media only screen and (max-width: 520px) {
      .card-pad { padding: 28px 22px 30px !important; }
      .outer-pad { padding: 24px 12px !important; }
      .h1 { font-size: 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f8fafb;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;visibility:hidden;mso-hide:all;">${escapeHtml(opts.preheader)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafb;">
    <tr>
      <td align="center" class="outer-pad" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="height:3px;line-height:3px;background-color:#A2EA49;font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td class="card-pad" style="padding:36px 32px 32px;">

              <!-- Brand -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="width:36px;height:36px;background-color:#0a0a0a;border-radius:10px;text-align:center;vertical-align:middle;">
                    <span style="display:block;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:800;letter-spacing:-0.04em;color:#ffffff;line-height:36px;">O</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13.5px;font-weight:700;letter-spacing:-0.02em;color:#0f172a;">OpenInstaDM</span>
                    <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#94a3b8;margin-left:8px;vertical-align:middle;">${escapeHtml(opts.badgeLabel)}</span>
                  </td>
                </tr>
              </table>

              <!-- Heading -->
              <h1 class="h1" style="margin:0 0 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:21px;font-weight:700;letter-spacing:-0.03em;line-height:1.25;color:#0f172a;">
                ${safeTitle}
              </h1>

              <!-- Intro -->
              <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.7;color:#475569;">
                ${opts.introHtml}
              </div>

              <!-- CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 18px;">
                <tr>
                  <td style="border-radius:10px;background-color:#0a0a0a;">
                    <a href="${safeCtaUrl}" target="_blank" rel="noopener noreferrer"
                       style="display:inline-block;padding:13px 26px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;letter-spacing:-0.01em;color:#ffffff;text-decoration:none;line-height:18px;">
                      ${safeCtaLabel}&nbsp;&nbsp;→
                    </a>
                  </td>
                </tr>
              </table>

              ${
                safeMeta
                  ? `<p style="margin:0 0 22px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12.5px;line-height:1.6;color:#94a3b8;">${safeMeta}</p>`
                  : ""
              }

              <!-- Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
                <tr><td style="height:1px;background-color:#f1f5f9;line-height:1px;font-size:0;">&nbsp;</td></tr>
              </table>

              <!-- Fallback -->
              <p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#94a3b8;">
                ${escapeHtml(opts.fallbackHint ?? "Button not working?")}
              </p>
              <p style="margin:0 0 6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#64748b;">
                Copy and paste this link into your browser:
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafb;border:1px solid #e2e8f0;border-radius:8px;">
                <tr>
                  <td style="padding:10px 12px;word-break:break-all;">
                    <a href="${safeCtaUrl}" target="_blank" rel="noopener noreferrer" style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;font-size:11px;line-height:1.6;color:#334155;text-decoration:none;word-break:break-all;">${safeCtaUrl}</a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>

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

function initialFromName(name: string): string {
  const t = name.trim();
  if (!t) return "•";
  return t[0]!.toUpperCase();
}

/* ------------------------------------------------------------------ */
/*  Public senders                                                     */
/* ------------------------------------------------------------------ */

export async function sendInviteEmail(payload: InviteEmailPayload): Promise<boolean> {
  const subject = `You're invited to join ${payload.workspaceName} on OpenInstaDM`;
  const safeWorkspace = escapeHtml(payload.workspaceName);
  const safeInviter = escapeHtml(payload.invitedBy);
  const initial = escapeHtml(initialFromName(payload.invitedBy));

  const introHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
      <tr>
        <td style="width:40px;height:40px;background-color:#f1f5f9;border:1px solid #e2e8f0;border-radius:9999px;text-align:center;vertical-align:middle;">
          <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#0f172a;line-height:40px;">${initial}</span>
        </td>
        <td style="padding-left:12px;vertical-align:middle;">
          <p style="margin:0;font-size:14px;line-height:1.5;color:#0f172a;">
            <span style="font-weight:700;">${safeInviter}</span> <span style="color:#64748b;">invited you to</span> <span style="font-weight:700;">${safeWorkspace}</span>
          </p>
          <p style="margin:2px 0 0;font-size:12.5px;line-height:1.5;color:#94a3b8;">Member&nbsp;·&nbsp;OpenInstaDM workspace</p>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:14px;line-height:1.7;color:#475569;">
      Accept your invitation to start collaborating on Instagram comment-to-DM automations — manage posts, flows, and DMs together.
    </p>
  `;

  const html = emailShell({
    preheader: `${payload.invitedBy} invited you to join ${payload.workspaceName} on OpenInstaDM`,
    badgeLabel: "Invitation",
    title: `You’re invited to <span style="color:#0f172a;">${safeWorkspace}</span>`,
    introHtml,
    cta: { label: "Accept invitation", url: payload.inviteUrl },
    metaLine: "This invitation expires in 14 days. If you weren’t expecting this, you can ignore this email.",
    fallbackHint: "Button not working?",
  });

  const text = [
    `${payload.invitedBy} invited you to join ${payload.workspaceName} as a member on OpenInstaDM.`,
    ``,
    `Accept your invitation: ${payload.inviteUrl}`,
    ``,
    `This invitation expires in 14 days.`,
  ].join("\n");

  return sendEmail({ to: payload.to, subject, html, text });
}

export async function sendMemberAddedEmail(
  payload: MemberAddedEmailPayload
): Promise<boolean> {
  const subject = `You've been added to ${payload.workspaceName} on OpenInstaDM`;
  const safeWorkspace = escapeHtml(payload.workspaceName);

  const introHtml = `
    <p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:#475569;">
      You’ve been added to <span style="font-weight:700;color:#0f172a;">${safeWorkspace}</span> as a <span style="font-weight:600;color:#0f172a;">Member</span>.
    </p>
    <p style="margin:0;font-size:14px;line-height:1.7;color:#475569;">
      Sign in to access the workspace, manage automations, and collaborate with your team.
    </p>
  `;

  const html = emailShell({
    preheader: `You’ve been added to ${payload.workspaceName} on OpenInstaDM — open your dashboard`,
    badgeLabel: "Workspace",
    title: `You’re in — welcome to <span style="color:#0f172a;">${safeWorkspace}</span>`,
    introHtml,
    cta: { label: "Open dashboard", url: payload.signInUrl },
    metaLine: "You now have access as a Member. If this was unexpected, contact your workspace admin.",
  });

  const text = [
    `You've been added to ${payload.workspaceName} as a member on OpenInstaDM.`,
    ``,
    `Open your dashboard: ${payload.signInUrl}`,
  ].join("\n");

  return sendEmail({ to: payload.to, subject, html, text });
}
