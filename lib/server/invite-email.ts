/**
 * Invite email delivery (Resend REST API).
 *
 * Mirrors the approach NextAuth's Resend provider uses — a plain `fetch` to
 * https://api.resend.com/emails with a bearer token — so no SDK dependency is
 * needed. Sending is best-effort: a failed send never fails the invite
 * mutation itself (the inviter still gets the copyable link in the UI).
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

async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // No key configured (local dev without email) — skip silently so invite
    // creation still works; the Copy link button is the fallback.
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

/** Inline-styled HTML shell shared by both invite emails. */
function emailShell(title: string, bodyHtml: string, cta: { label: string; url: string }) {
  return `
    <div style="background-color:#f6f6f7;padding:40px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <div style="max-width:480px;margin:0 auto;background-color:#ffffff;border-radius:12px;padding:32px;">
        <p style="margin:0 0 24px;font-size:16px;font-weight:700;color:#18181b;">OpenInstaDM</p>
        <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#18181b;">${title}</h1>
        <div style="font-size:14px;line-height:1.6;color:#52525b;">${bodyHtml}</div>
        <div style="margin:28px 0 0;">
          <a href="${cta.url}" style="display:inline-block;background-color:#18181b;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:10px 18px;border-radius:8px;">${cta.label}</a>
        </div>
        <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;">
          If the button doesn't work, paste this link into your browser:<br/>
          <a href="${cta.url}" style="color:#52525b;">${cta.url}</a>
        </p>
      </div>
    </div>
  `;
}

export async function sendInviteEmail(payload: InviteEmailPayload): Promise<boolean> {
  const subject = `You're invited to join ${payload.workspaceName} on OpenInstaDM`;
  const bodyHtml = `
    <p style="margin:0 0 12px;"><strong>${payload.invitedBy}</strong> invited you to join
    <strong>${payload.workspaceName}</strong> as a <strong>member</strong>.</p>
    <p style="margin:0;">Accept the invite to start collaborating on Instagram
    comment-to-DM automations.</p>
  `;
  const bodyText = `${payload.invitedBy} invited you to join ${payload.workspaceName} as a member on OpenInstaDM.\n\nAccept the invite: ${payload.inviteUrl}`;

  return sendEmail({
    to: payload.to,
    subject,
    html: emailShell(subject, bodyHtml, {
      label: "Accept invitation",
      url: payload.inviteUrl,
    }),
    text: bodyText,
  });
}

export async function sendMemberAddedEmail(
  payload: MemberAddedEmailPayload
): Promise<boolean> {
  const subject = `You've been added to ${payload.workspaceName} on OpenInstaDM`;
  const bodyHtml = `
    <p style="margin:0 0 12px;">You've been added to
    <strong>${payload.workspaceName}</strong> as a <strong>member</strong>.</p>
    <p style="margin:0;">Sign in to start collaborating on Instagram
    comment-to-DM automations.</p>
  `;
  const bodyText = `You've been added to ${payload.workspaceName} as a member on OpenInstaDM.\n\nSign in: ${payload.signInUrl}`;

  return sendEmail({
    to: payload.to,
    subject,
    html: emailShell(subject, bodyHtml, {
      label: "Open dashboard",
      url: payload.signInUrl,
    }),
    text: bodyText,
  });
}
