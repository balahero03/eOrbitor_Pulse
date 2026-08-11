import nodemailer from 'nodemailer';
import { after } from 'next/server';
import { LOGO_CID, logoAttachment } from '@/lib/emailAssets';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PROTOCOL === 'ssl',
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  } : undefined,
  tls: { rejectUnauthorized: false },
  // Without these, an unreachable or black-holed SMTP host hangs on the OS
  // default TCP timeout (minutes). Every caller here already treats mail as
  // best-effort, so fail fast and log rather than holding the request open.
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  socketTimeout: 10000,
});

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  /**
   * Content-ID for an inline image, referenced from the HTML as
   * `<img src="cid:the-value">`. Set this and the part is embedded in the
   * message body instead of appearing as a downloadable attachment.
   */
  cid?: string;
}

// Why this exists: `sendMail` used to swallow every failure and return void,
// so callers had no way to tell "delivered" from "the SMTP host doesn't
// exist". Flows that tell a user "check your inbox" need the truth, or they
// send people to wait on mail that was never sent. Failures are still never
// thrown — mail stays best-effort — they're just now reportable.
export type MailResult =
  | { ok: true }
  | { ok: false; reason: 'not_configured' | 'send_failed'; error?: string };

export function isMailConfigured(): boolean {
  return !!process.env.SMTP_HOST;
}

/**
 * Send mail *after* the HTTP response has been returned.
 *
 * Use this instead of `void sendMail(...)`. A bare floating promise does not
 * survive here: Next finishes the request as soon as the handler returns and
 * tears the context down, so an SMTP conversation still in progress — roughly
 * two seconds against a hosted relay — is abandoned before it completes. The
 * failure is silent and total; the caller sees its 200, the DB row it wrote is
 * there, and no mail is ever sent. `after()` exists precisely for this, and
 * keeps the invocation alive until the callback finishes.
 *
 * Deferring rather than awaiting also preserves a property `/forgot-password`
 * depends on: every response takes about the same time, so an account that
 * exists cannot be told apart from one that doesn't by timing the reply.
 *
 * Callers that must *report* delivery to the user (email verification) should
 * still `await sendMail` directly — they need the result before responding.
 */
export function sendMailAfterResponse(label: string, opts: Parameters<typeof sendMail>[0]): void {
  after(async () => {
    try {
      const result = await sendMail(opts);
      if (result.ok) {
        console.log(`[MAIL] ${label} -> ${Array.isArray(opts.to) ? opts.to.join(', ') : opts.to}`);
      } else {
        console.error(`[MAIL] ${label} NOT SENT (${result.reason})`, result.error ?? '');
      }
    } catch (err) {
      console.error(`[MAIL] ${label} threw`, err);
    }
  });
}

export async function sendMail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: MailAttachment[];
}): Promise<MailResult> {
  if (!isMailConfigured()) {
    console.log('[MAIL - no SMTP configured] To:', opts.to, '| Subject:', opts.subject);
    return { ok: false, reason: 'not_configured' };
  }
  // Attach the logo automatically whenever the body references it, rather than
  // asking each call site to remember. A missing part renders as a broken-image
  // placeholder in the recipient's inbox — a failure nobody sees while testing,
  // because the sender's own client often resolves it from cache.
  const attachments = [...(opts.attachments ?? [])];
  const needsLogo = opts.html.includes(`cid:${LOGO_CID}`)
    && !attachments.some((a) => a.cid === LOGO_CID);
  if (needsLogo) attachments.push(logoAttachment());

  try {
    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'eOrbitor Pulse'}" <${process.env.SMTP_FROM_EMAIL || 'crm@eorbitor.local'}>`,
      to: Array.isArray(opts.to) ? opts.to.join(', ') : opts.to,
      subject: opts.subject,
      html: opts.html,
      attachments: attachments.length
        ? attachments.map(a => ({
            filename: a.filename,
            content: a.content,
            contentType: a.contentType,
            ...(a.cid ? { cid: a.cid, contentDisposition: 'inline' as const } : {}),
          }))
        : undefined,
    });
    return { ok: true };
  } catch (err: any) {
    console.error('[MAIL ERROR]', err);
    return { ok: false, reason: 'send_failed', error: err?.message || String(err) };
  }
}

// ─── Shared transactional layout ────────────────────────────────────────────
//
// Every security email uses this shell so they are recognisably from the same
// system — which is itself a phishing defence: a consistent house style makes
// a forged message easier to notice.
//
// Written as nested tables with inline styles, not the flexbox/divs the rest
// of this codebase uses. Outlook renders through Word's HTML engine, which
// ignores modern layout entirely; tables are the only construct that survives
// across Gmail, Outlook and Apple Mail intact.
const BRAND = {
  ink: '#1a2231',
  body: '#404b5c',
  muted: '#7b8695',
  rule: '#e3e7ec',
  page: '#f4f6f8',
  accent: '#1d4ed8',
};

function emailShell(opts: {
  preheader: string;
  title: string;
  bodyHtml: string;
  accentBar?: string;
}) {
  const { preheader, title, bodyHtml, accentBar = BRAND.accent } = opts;
  return `<!--[if mso]><style>body,table,td{font-family:Arial,Helvetica,sans-serif !important}</style><![endif]-->
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BRAND.page};margin:0;padding:0">
  <tr><td align="center" style="padding:32px 12px">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%;background:#ffffff;border:1px solid ${BRAND.rule};border-radius:10px;overflow:hidden">

      <tr><td style="height:3px;background:${accentBar};font-size:0;line-height:0">&nbsp;</td></tr>

      <!-- The logo sits on an explicit #ffffff cell: Gmail's dark theme
           recolours surrounding surfaces, and the wordmark is dark blue on
           white, so without this it can end up dark-on-dark. -->
      <tr><td align="center" style="background:#ffffff;padding:30px 40px 22px">
        <img src="cid:${LOGO_CID}" width="200" alt="eOrbitor"
             style="display:block;width:200px;max-width:60%;height:auto;border:0" />
      </td></tr>

      <tr><td style="padding:0 40px">
        <div style="height:1px;background:${BRAND.rule};font-size:0;line-height:0">&nbsp;</div>
      </td></tr>

      <tr><td style="padding:30px 40px 34px;font-family:Helvetica,Arial,sans-serif">
        <h1 style="margin:0 0 20px;font-size:19px;line-height:1.35;font-weight:600;color:${BRAND.ink};letter-spacing:-0.2px">${title}</h1>
        ${bodyHtml}
      </td></tr>

      <tr><td style="background:#fafbfc;border-top:1px solid ${BRAND.rule};padding:20px 40px;font-family:Helvetica,Arial,sans-serif">
        <p style="margin:0 0 4px;font-size:12px;line-height:1.6;color:${BRAND.muted}">
          This is an automated message from <strong style="color:${BRAND.body}">eOrbitor Pulse</strong>. Please do not reply.
        </p>
        <p style="margin:0;font-size:11px;line-height:1.6;color:${BRAND.muted}">
          eOrbitor &middot; Technology for Better Tomorrow
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>`;
}

const P = `margin:0 0 16px;font-size:14px;line-height:1.65;color:${BRAND.body};font-family:Helvetica,Arial,sans-serif`;

// A bordered advisory block. `tone` picks the semantic colour; the structure
// is identical so these read as the same component wherever they appear.
function noticeBlock(tone: 'warning' | 'danger' | 'neutral', html: string) {
  const c = {
    warning: { bg: '#fffbeb', border: '#fde3a7', text: '#8a5a00' },
    danger: { bg: '#fef4f2', border: '#f8cdc4', text: '#9b2c17' },
    neutral: { bg: '#f7f9fb', border: BRAND.rule, text: BRAND.body },
  }[tone];
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:22px 0 0">
    <tr><td style="background:${c.bg};border:1px solid ${c.border};border-radius:6px;padding:14px 16px">
      <p style="margin:0;font-size:12.5px;line-height:1.65;color:${c.text};font-family:Helvetica,Arial,sans-serif">${html}</p>
    </td></tr>
  </table>`;
}

function formatIST(when: Date): string {
  return when.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata',
  }) + ' IST';
}

// ─── Password Reset Code ────────────────────────────────────────────────────
// A code rather than a link: mail security appliances routinely pre-open every
// URL in an incoming message, which spends a single-use link before its owner
// ever sees it. Reading a message cannot spend a code.
export function buildPasswordResetCodeEmail(params: { firstName: string; code: string; expiresInMinutes: number }) {
  const { firstName, code, expiresInMinutes } = params;
  // Split into two groups — six unbroken digits are noticeably harder to carry
  // across to another window without a transcription slip.
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  return emailShell({
    // Shown next to the subject in most inbox previews. Deliberately omits the
    // code so it cannot be read off a lock screen without opening the message.
    preheader: 'A verification code was requested for your eOrbitor Pulse account.',
    title: 'Verification code for your password reset',
    bodyHtml: `
      <p style="${P}">Dear ${firstName},</p>
      <p style="${P}">
        We received a request to reset the password for your eOrbitor Pulse account.
        Enter the verification code below to continue.
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:26px 0 20px">
        <tr><td align="center" style="background:#f7f9fc;border:1px solid #d6dfec;border-radius:8px;padding:22px 16px">
          <div style="font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:${BRAND.muted};font-family:Helvetica,Arial,sans-serif;margin-bottom:10px">Verification code</div>
          <div style="font-family:'SF Mono',Menlo,Consolas,'Courier New',monospace;font-size:32px;font-weight:700;letter-spacing:9px;color:${BRAND.ink};line-height:1.1">${spaced}</div>
          <div style="font-size:12px;color:${BRAND.muted};font-family:Helvetica,Arial,sans-serif;margin-top:12px">
            Valid for ${expiresInMinutes} minutes &middot; single use
          </div>
        </td></tr>
      </table>

      <p style="${P}">
        For your security, this code expires shortly and can only be used once.
        If it expires, you can request a new one from the sign-in page.
      </p>

      ${noticeBlock('danger', `
        <strong>eOrbitor will never ask you for this code.</strong> If you did not request a
        password reset, no action is needed &mdash; your password remains unchanged. Please
        notify your administrator so the request can be reviewed.
      `)}
    `,
  });
}

// ─── Password Changed Alert ─────────────────────────────────────────────────
// Sent on every password change, however it happened. Without this a silent
// takeover stays silent — the victim's first signal would be being unable to
// log in, long after the fact.
export function buildPasswordChangedEmail(params: { firstName: string; when: Date; method: 'reset' | 'self' | 'admin' }) {
  const { firstName, when, method } = params;
  const how = {
    reset: 'Password reset using an emailed verification code',
    self: 'Changed from the profile page while signed in',
    admin: 'Changed by an administrator',
  }[method];
  return emailShell({
    preheader: 'The password for your eOrbitor Pulse account was changed.',
    title: 'Your password was changed',
    accentBar: '#15803d',
    bodyHtml: `
      <p style="${P}">Dear ${firstName},</p>
      <p style="${P}">
        This is a confirmation that the password for your eOrbitor Pulse account was
        changed. As a security measure, all active sessions have been signed out and
        you will need to sign in again on each device.
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:22px 0 4px;border:1px solid ${BRAND.rule};border-radius:6px">
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid ${BRAND.rule};font-size:12px;color:${BRAND.muted};font-family:Helvetica,Arial,sans-serif;width:35%">Date &amp; time</td>
          <td style="padding:12px 16px;border-bottom:1px solid ${BRAND.rule};font-size:13px;color:${BRAND.ink};font-family:Helvetica,Arial,sans-serif">${formatIST(when)}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;font-size:12px;color:${BRAND.muted};font-family:Helvetica,Arial,sans-serif">Method</td>
          <td style="padding:12px 16px;font-size:13px;color:${BRAND.ink};font-family:Helvetica,Arial,sans-serif">${how}</td>
        </tr>
      </table>

      ${noticeBlock('danger', `
        <strong>If you did not make this change, act immediately.</strong> Reset your password
        again from the sign-in page and contact your administrator &mdash; another person may
        have access to this account.
      `)}
    `,
  });
}

// ─── Recovery Email Changed Alert ───────────────────────────────────────────
// Goes to the address being replaced, not the new one. Whoever controls the
// new address already knows; the person who needs warning is the one about to
// lose their route back into the account.
export function buildRecoveryEmailChangedEmail(params: { firstName: string; newEmailMasked: string }) {
  const { firstName, newEmailMasked } = params;
  return emailShell({
    preheader: 'The recovery email on your eOrbitor Pulse account was changed.',
    title: 'Your recovery email was changed',
    accentBar: '#c2410c',
    bodyHtml: `
      <p style="${P}">Dear ${firstName},</p>
      <p style="${P}">
        The recovery email on your eOrbitor Pulse account has been changed from this
        address to <strong style="color:${BRAND.ink}">${newEmailMasked}</strong>.
      </p>
      <p style="${P}">
        Password reset codes will now be delivered to the new address. This message is
        being sent to your previous address so you are aware of the change.
      </p>

      ${noticeBlock('danger', `
        <strong>If you did not make this change, contact your administrator immediately.</strong>
        Someone with access to your account may be redirecting password recovery to a
        mailbox they control.
      `)}
    `,
  });
}

// Show enough of an address to be recognisable without reprinting it in full
// in a message that may itself be going somewhere untrusted.
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '•••';
  const head = local.slice(0, 2);
  return `${head}${'•'.repeat(Math.max(3, local.length - 2))}@${domain}`;
}

// ─── Email Verification Email ───────────────────────────────────────────────
export function buildEmailVerificationEmail(params: { firstName: string; verifyUrl: string; expiresInMinutes: number }) {
  const { firstName, verifyUrl, expiresInMinutes } = params;
  return emailShell({
    preheader: 'Confirm your recovery email address for eOrbitor Pulse.',
    title: 'Confirm your recovery email address',
    accentBar: '#15803d',
    bodyHtml: `
      <p style="${P}">Dear ${firstName},</p>
      <p style="${P}">
        This address has been added as the recovery email on your eOrbitor Pulse account.
        Please confirm it so it can be used to reset your password if you are ever locked out.
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px auto 20px">
        <tr><td align="center" style="background:#15803d;border-radius:6px">
          <a href="${verifyUrl}"
             style="display:inline-block;padding:13px 34px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none">
            Confirm Email Address
          </a>
        </td></tr>
      </table>

      <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:${BRAND.muted};font-family:Helvetica,Arial,sans-serif">
        If the button does not work, copy this link into your browser:
      </p>
      <p style="margin:0;font-size:12px;line-height:1.6;color:${BRAND.accent};word-break:break-all;font-family:Helvetica,Arial,sans-serif">${verifyUrl}</p>

      ${noticeBlock('neutral', `
        This link expires in ${expiresInMinutes} minutes and can be used once.
        If you did not add this address to an eOrbitor Pulse profile, you can disregard this message.
      `)}
    `,
  });
}

// ─── WON Email ────────────────────────────────────────────────────────────────
export function buildWonEmail(params: {
  lead: { name: string; company: string; quoteValue?: any };
  rep: string;
  manager: string;
  quoteRef?: string;
  poNumber?: string;
  reasonOfWin?: string;
  whatWentWell?: string;
  attachmentNames?: string[];
}) {
  const { lead, rep, manager, quoteRef, poNumber, reasonOfWin, whatWentWell, attachmentNames } = params;
  const val = lead.quoteValue ? `₹${Number(lead.quoteValue).toLocaleString('en-IN')}` : '';

  return `
  <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #d1fae5">
    <div style="background:linear-gradient(135deg,#16a34a,#15803d);padding:28px 32px">
      <h1 style="margin:0;color:#fff;font-size:22px">🏆 Lead WON!</h1>
      <p style="margin:6px 0 0;color:#bbf7d0;font-size:15px">${lead.company} — ${lead.name}</p>
    </div>

    <div style="padding:28px 32px;background:#f0fdf4">
      <!-- Deal Summary -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <tr>
          <td style="padding:8px 12px;background:#dcfce7;border-radius:8px;width:50%;vertical-align:top">
            <p style="margin:0;font-size:11px;color:#166534;text-transform:uppercase;font-weight:700;letter-spacing:.5px">Opportunity</p>
            <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#14532d">${lead.name}</p>
          </td>
          <td style="padding:0 0 0 12px;width:50%;vertical-align:top">
            <table style="width:100%;border-collapse:collapse">
              ${val ? `<tr><td style="padding:4px 0;font-size:13px;color:#374151"><strong>Deal Value:</strong></td><td style="padding:4px 0;font-size:15px;font-weight:700;color:#16a34a;text-align:right">${val}</td></tr>` : ''}
              ${quoteRef ? `<tr><td style="padding:4px 0;font-size:13px;color:#374151"><strong>Quote Ref:</strong></td><td style="padding:4px 0;font-size:13px;color:#111;text-align:right">${quoteRef}</td></tr>` : ''}
              ${poNumber ? `<tr><td style="padding:4px 0;font-size:13px;color:#374151"><strong>PO Number:</strong></td><td style="padding:4px 0;font-size:13px;color:#111;font-weight:600;text-align:right">${poNumber}</td></tr>` : ''}
              <tr><td style="padding:4px 0;font-size:13px;color:#374151"><strong>Closed By:</strong></td><td style="padding:4px 0;font-size:13px;color:#111;text-align:right">${rep}</td></tr>
              <tr><td style="padding:4px 0;font-size:13px;color:#374151"><strong>Reported To:</strong></td><td style="padding:4px 0;font-size:13px;color:#111;text-align:right">${manager}</td></tr>
            </table>
          </td>
        </tr>
      </table>

      ${reasonOfWin ? `
      <div style="background:#fff;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:14px">
        <p style="margin:0 0 6px;font-size:12px;color:#16a34a;font-weight:700;text-transform:uppercase;letter-spacing:.5px">🎯 Reason of Win</p>
        <p style="margin:0;font-size:14px;color:#1f2937;line-height:1.6">${reasonOfWin}</p>
      </div>` : ''}

      ${whatWentWell ? `
      <div style="background:#fff;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:14px">
        <p style="margin:0 0 6px;font-size:12px;color:#16a34a;font-weight:700;text-transform:uppercase;letter-spacing:.5px">✅ What Went Well</p>
        <p style="margin:0;font-size:14px;color:#1f2937;line-height:1.6">${whatWentWell}</p>
      </div>` : ''}

      ${attachmentNames && attachmentNames.length > 0 ? `
      <div style="background:#fff;border:1px solid #d1fae5;border-radius:8px;padding:14px;margin-bottom:14px">
        <p style="margin:0 0 8px;font-size:12px;color:#16a34a;font-weight:700;text-transform:uppercase;letter-spacing:.5px">📎 Attached Documents</p>
        ${attachmentNames.map(n => `<p style="margin:3px 0;font-size:13px;color:#374151">• ${n}</p>`).join('')}
      </div>` : ''}

      <div style="background:#dcfce7;border-radius:8px;padding:14px;text-align:center">
        <p style="margin:0;font-size:14px;color:#166534;font-weight:600">Lead moved to <strong>Orders</strong> — please proceed with order creation.</p>
      </div>
    </div>

    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb">
      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center">eOrbitor Pulse CRM · Auto-generated notification</p>
    </div>
  </div>`;
}

// ─── LOST / DROPPED Email ─────────────────────────────────────────────────────
export function buildLostEmail(params: {
  lead: { name: string; company: string; quoteValue?: any };
  outcome: 'LOST' | 'DROPPED';
  reason: string;
  rep: string;
  competitor?: string;
  whatToImprove?: string;
  attachmentNames?: string[];
}) {
  const { lead, outcome, reason, rep, competitor, whatToImprove, attachmentNames } = params;
  const isLost = outcome === 'LOST';
  const accent = isLost ? '#dc2626' : '#6b7280';
  const lightBg = isLost ? '#fef2f2' : '#f9fafb';
  const borderCol = isLost ? '#fecaca' : '#e5e7eb';
  const textCol = isLost ? '#991b1b' : '#374151';

  return `
  <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid ${borderCol}">
    <div style="background:${accent};padding:28px 32px">
      <h1 style="margin:0;color:#fff;font-size:22px">${isLost ? '❌ Lead LOST' : '🚫 Lead DROPPED'}</h1>
      <p style="margin:6px 0 0;color:${isLost ? '#fecaca' : '#d1d5db'};font-size:15px">${lead.company} — ${lead.name}</p>
    </div>

    <div style="padding:28px 32px;background:${lightBg}">
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <tr>
          <td style="padding:8px;background:${borderCol};border-radius:8px;width:50%;vertical-align:top">
            <p style="margin:0;font-size:11px;color:${textCol};text-transform:uppercase;font-weight:700">Opportunity</p>
            <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#111">${lead.name}</p>
          </td>
          <td style="padding:0 0 0 12px;width:50%;vertical-align:top">
            <table style="width:100%;border-collapse:collapse">
              ${lead.quoteValue ? `<tr><td style="padding:4px 0;font-size:13px;color:#374151"><strong>Deal Value:</strong></td><td style="padding:4px 0;font-size:13px;text-align:right">₹${Number(lead.quoteValue).toLocaleString('en-IN')}</td></tr>` : ''}
              ${competitor ? `<tr><td style="padding:4px 0;font-size:13px;color:#374151"><strong>Competitor:</strong></td><td style="padding:4px 0;font-size:13px;font-weight:600;color:${accent};text-align:right">${competitor}</td></tr>` : ''}
              <tr><td style="padding:4px 0;font-size:13px;color:#374151"><strong>Outcome:</strong></td><td style="padding:4px 0;font-size:13px;font-weight:600;text-align:right">${outcome}</td></tr>
              <tr><td style="padding:4px 0;font-size:13px;color:#374151"><strong>Closed By:</strong></td><td style="padding:4px 0;font-size:13px;text-align:right">${rep}</td></tr>
            </table>
          </td>
        </tr>
      </table>

      ${reason ? `
      <div style="background:#fff;border:1px solid ${borderCol};border-radius:8px;padding:16px;margin-bottom:14px">
        <p style="margin:0 0 6px;font-size:12px;color:${accent};font-weight:700;text-transform:uppercase;letter-spacing:.5px">${isLost ? '❌ Reason of Loss' : '🚫 Reason for Drop'}</p>
        <p style="margin:0;font-size:14px;color:#1f2937;line-height:1.6">${reason}</p>
      </div>` : ''}

      ${whatToImprove ? `
      <div style="background:#fff;border:1px solid ${borderCol};border-radius:8px;padding:16px;margin-bottom:14px">
        <p style="margin:0 0 6px;font-size:12px;color:#d97706;font-weight:700;text-transform:uppercase;letter-spacing:.5px">💡 What to Improve</p>
        <p style="margin:0;font-size:14px;color:#1f2937;line-height:1.6">${whatToImprove}</p>
      </div>` : ''}

      ${attachmentNames && attachmentNames.length > 0 ? `
      <div style="background:#fff;border:1px solid ${borderCol};border-radius:8px;padding:14px;margin-bottom:14px">
        <p style="margin:0 0 8px;font-size:12px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:.5px">📎 Attached Documents</p>
        ${attachmentNames.map(n => `<p style="margin:3px 0;font-size:13px;color:#374151">• ${n}</p>`).join('')}
      </div>` : ''}

      <div style="background:${borderCol};border-radius:8px;padding:14px;text-align:center">
        <p style="margin:0;font-size:14px;color:${textCol}">This lead has been archived in <strong>Closed Leads</strong>. Review learnings for the next opportunity.</p>
      </div>
    </div>

    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb">
      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center">eOrbitor Pulse CRM · Auto-generated notification</p>
    </div>
  </div>`;
}
