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
  | { ok: false; reason: 'not_configured' | 'send_failed'; error?: string; code?: string; diagnosis?: string };

export function isMailConfigured(): boolean {
  return !!process.env.SMTP_HOST;
}

/**
 * Turn a raw connection/SMTP error into a sentence an administrator can act
 * on, instead of a Node error code they have to go look up.
 *
 * This exists because "the mail server is unreachable" was the *entire*
 * diagnostic available on a production failure — one sentence, no way to
 * tell a DNS problem from a firewalled port from a rejected password without
 * shell access to read the server log. On a self-hosted, on-premise
 * deployment the operator usually *is* looking at this screen, so the
 * diagnosis is worth surfacing directly rather than only logging it.
 */
// Verified against real nodemailer/Node failures, not documentation: DNS
// failures surface as `EDNS` (not `ENOTFOUND`, which only appears inside the
// message text), and nodemailer wraps every raw socket error — including a
// plain ECONNREFUSED — under one `ESOCKET` code. Whichever of those it was is
// only recoverable from the message text, so ESOCKET is disambiguated there
// rather than guessed at from the code alone.
function classifyMailError(err: any): string {
  const code = err?.code;
  const message = String(err?.message || '');
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT || '587';

  if (code === 'EDNS' || code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return `Cannot resolve "${host}" — check SMTP_HOST, or DNS from this server.`;
  }
  if (code === 'EAUTH') {
    return 'The mail server rejected SMTP_USER/SMTP_PASSWORD — check those credentials.';
  }
  if (code === 'ESOCKET' && /ECONNREFUSED/.test(message)) {
    return `Connection to ${host}:${port} was refused — nothing is listening there, or a firewall is dropping it immediately.`;
  }
  if (code === 'ESOCKET' && /ECONNRESET/.test(message)) {
    return `The connection to ${host}:${port} was reset mid-handshake — check for a proxy or firewall interfering with outbound TLS.`;
  }
  if (code === 'ETIMEDOUT' || code === 'ESOCKET') {
    return `Connection to ${host}:${port} timed out — likely outbound traffic to this host/port is blocked by a firewall or security group. This is common on an on-premise host with restricted egress.`;
  }
  return message || 'Unknown error contacting the mail server.';
}

/** Worth one retry: a blip, not a structural reason the send will never work. */
function isTransientMailError(err: any): boolean {
  return ['ETIMEDOUT', 'ESOCKET', 'ECONNRESET'].includes(err?.code);
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
        console.error(`[MAIL] ${label} NOT SENT (${result.reason})`, result.diagnosis ?? result.error ?? '');
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

  const message = {
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
  };

  // One retry, and only for errors that plausibly resolve on their own — a
  // dropped connection or a slow handshake, not "this host doesn't exist" or
  // "the password is wrong," where trying again a second later changes
  // nothing. Self-hosted deployments are more prone to exactly this kind of
  // transient failure than a cloud host with settled routing: NAT/proxy
  // hiccups on the way out, a security appliance dropping the first
  // handshake, etc.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await transporter.sendMail(message);
      return { ok: true };
    } catch (err: any) {
      const willRetry = attempt === 0 && isTransientMailError(err);
      console.error(`[MAIL ERROR]${willRetry ? ' (retrying once)' : ''}`, err?.code || '', err?.message || err);
      if (willRetry) {
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }
      return {
        ok: false,
        reason: 'send_failed',
        error: err?.message || String(err),
        code: err?.code,
        diagnosis: classifyMailError(err),
      };
    }
  }
  // Unreachable — the loop always returns — but keeps TypeScript satisfied.
  return { ok: false, reason: 'send_failed', error: 'unknown' };
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
  // Outcome accents, named by meaning rather than colour so a future palette
  // change happens in one place.
  positive: '#15803d',
  negative: '#b91c1c',
  neutralAccent: '#525c6b',
  caution: '#c2410c',
};

/**
 * Escape a value before it is interpolated into email HTML.
 *
 * Every builder below composes HTML by string concatenation, and almost every
 * value it interpolates is user-authored — a company name, a rep's note, an
 * uploaded filename. Unescaped, `Sharma & Co <Pvt> Ltd` renders as
 * `Sharma & Co  Ltd` with the middle swallowed as an unknown tag, and a
 * deliberately crafted value can restyle or truncate the rest of the message.
 * The recipients here are managers and administrators, so the blast radius is
 * exactly the wrong set of inboxes.
 */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escape, then honour line breaks. Free-text fields ("what went well", "reason
 * of loss") are written in a textarea, so the newlines the author typed are
 * meaningful; HTML would otherwise collapse the whole note into one paragraph.
 */
function escMultiline(value: unknown): string {
  return esc(value).replace(/\r?\n/g, '<br />');
}

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
        <p style="margin:0 0 5px;font-size:12px;line-height:1.6;color:${BRAND.body}">
          <strong style="color:${BRAND.ink}">eOrbitor Pulse</strong> &middot; Sales &amp; Operations Platform
        </p>
        <p style="margin:0 0 5px;font-size:11.5px;line-height:1.6;color:${BRAND.muted}">
          This message was generated automatically. Replies to this address are not monitored.
        </p>
        <p style="margin:0;font-size:11px;line-height:1.6;color:${BRAND.muted}">
          &copy; ${new Date().getFullYear()} eOrbitor &middot; Technology for Better Tomorrow
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

/**
 * A label/value table — the workhorse of every notification body.
 *
 * One component rather than a hand-rolled table per email, so "Deal value" in
 * a won notification lines up with "Method" in a security alert. `null` rows
 * are dropped, which lets call sites express an optional field inline instead
 * of assembling the row list conditionally.
 */
function detailTable(rows: Array<[string, string] | null | false>): string {
  const present = rows.filter(Boolean) as Array<[string, string]>;
  if (!present.length) return '';
  const cells = present.map(([label, value], i) => {
    const edge = i === present.length - 1 ? '' : `border-bottom:1px solid ${BRAND.rule};`;
    return `<tr>
      <td style="padding:11px 16px;${edge}font-family:Helvetica,Arial,sans-serif;font-size:12px;color:${BRAND.muted};width:38%;vertical-align:top">${label}</td>
      <td style="padding:11px 16px;${edge}font-family:Helvetica,Arial,sans-serif;font-size:13px;color:${BRAND.ink};vertical-align:top">${value}</td>
    </tr>`;
  }).join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:22px 0 0;border:1px solid ${BRAND.rule};border-radius:6px;border-collapse:separate">${cells}</table>`;
}

/**
 * The single headline number of a message, set apart from the detail rows.
 * Managers skim these notifications on a phone; the deal value is the one
 * thing that should be readable without opening anything.
 */
function figureBlock(label: string, value: string, accent: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0 0">
    <tr><td align="center" style="background:#f7f9fc;border:1px solid #d9e1ec;border-radius:8px;padding:20px 16px">
      <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:${BRAND.muted};margin-bottom:8px">${label}</div>
      <div style="font-family:Helvetica,Arial,sans-serif;font-size:28px;line-height:1.15;font-weight:700;color:${accent}">${value}</div>
    </td></tr>
  </table>`;
}

/** A titled block of free text — a rep's note, quoted back to the reader. */
function noteBlock(label: string, bodyHtml: string, accent: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0 0">
    <tr><td style="border:1px solid ${BRAND.rule};border-left:3px solid ${accent};border-radius:6px;padding:14px 16px;background:#ffffff">
      <p style="margin:0 0 6px;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.9px;text-transform:uppercase;font-weight:700;color:${accent}">${label}</p>
      <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:13.5px;line-height:1.65;color:${BRAND.body}">${bodyHtml}</p>
    </td></tr>
  </table>`;
}

/** Names the files travelling with the message, so a stripped attachment is noticed. */
function attachmentList(names: string[]): string {
  if (!names.length) return '';
  const items = names
    .map(n => `<tr><td style="padding:3px 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;color:${BRAND.body}">&#8226;&nbsp; ${esc(n)}</td></tr>`)
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0 0">
    <tr><td style="border:1px solid ${BRAND.rule};border-radius:6px;padding:14px 16px">
      <p style="margin:0 0 8px;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:.9px;text-transform:uppercase;font-weight:700;color:${BRAND.muted}">Attached to this email (${names.length})</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">${items}</table>
    </td></tr>
  </table>`;
}

function formatINR(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return `&#8377;${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
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
      <p style="${P}">Dear ${esc(firstName)},</p>
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
      <p style="${P}">Dear ${esc(firstName)},</p>
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
      <p style="${P}">Dear ${esc(firstName)},</p>
      <p style="${P}">
        The recovery email on your eOrbitor Pulse account has been changed from this
        address to <strong style="color:${BRAND.ink}">${esc(newEmailMasked)}</strong>.
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
      <p style="${P}">Dear ${esc(firstName)},</p>
      <p style="${P}">
        This address has been added as the recovery email on your eOrbitor Pulse account.
        Please confirm it so it can be used to reset your password if you are ever locked out.
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px auto 20px">
        <tr><td align="center" style="background:#15803d;border-radius:6px">
          <a href="${esc(verifyUrl)}"
             style="display:inline-block;padding:13px 34px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none">
            Confirm Email Address
          </a>
        </td></tr>
      </table>

      <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:${BRAND.muted};font-family:Helvetica,Arial,sans-serif">
        If the button does not work, copy this link into your browser:
      </p>
      <p style="margin:0;font-size:12px;line-height:1.6;color:${BRAND.accent};word-break:break-all;font-family:Helvetica,Arial,sans-serif">${esc(verifyUrl)}</p>

      ${noticeBlock('neutral', `
        This link expires in ${expiresInMinutes} minutes and can be used once.
        If you did not add this address to an eOrbitor Pulse profile, you can disregard this message.
      `)}
    `,
  });
}

// ─── Lead closure notifications ─────────────────────────────────────────────
//
// These go to managers and administrators — often the first they hear that a
// deal landed or slipped. They previously rendered as their own thing: a
// CSS-gradient banner (Outlook drops gradients entirely, leaving white text on
// white), emoji headlines, no logo, and no preheader. They now use the same
// shell as every other message the system sends, so the whole mail estate is
// recognisably one product.

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
  const { lead, rep, manager, quoteRef, poNumber, reasonOfWin, whatWentWell, attachmentNames = [] } = params;
  // A zero or missing quote value is common on leads closed before the
  // commercials were entered; a hero panel reading "\u20B90" is worse than no
  // panel at all, so the figure only appears when there is a figure.
  const value = Number(lead.quoteValue) > 0 ? formatINR(lead.quoteValue) : '';

  return emailShell({
    preheader: `${esc(lead.company)} has been won${value ? ` \u2014 ${value}` : ''}. The lead has moved to Orders for fulfilment.`,
    title: `Opportunity won \u2014 ${esc(lead.company)}`,
    accentBar: BRAND.positive,
    bodyHtml: `
      <p style="${P}">
        <strong style="color:${BRAND.ink}">${esc(lead.name)}</strong> at
        <strong style="color:${BRAND.ink}">${esc(lead.company)}</strong> has been closed as won by
        ${esc(rep)}. An order has been raised automatically and the account is now live in the
        customer master.
      </p>

      ${value ? figureBlock('Order value', value, BRAND.positive) : ''}

      ${detailTable([
        ['Opportunity', esc(lead.name)],
        ['Account', esc(lead.company)],
        !!quoteRef && ['Quotation reference', esc(quoteRef)],
        !!poNumber && ['Purchase order', `<strong>${esc(poNumber)}</strong>`],
        ['Closed by', esc(rep)],
        ['Reported to', esc(manager)],
        ['Outcome', `<strong style="color:${BRAND.positive}">Won</strong>`],
      ])}

      ${reasonOfWin ? noteBlock('Reason for the win', escMultiline(reasonOfWin), BRAND.positive) : ''}
      ${whatWentWell ? noteBlock('What went well', escMultiline(whatWentWell), BRAND.positive) : ''}
      ${attachmentList(attachmentNames)}

      ${noticeBlock('neutral', `
        <strong style="color:${BRAND.ink}">Next step:</strong> the lead has moved to
        <strong>Orders</strong>. Please confirm the order details and begin fulfilment.
      `)}
    `,
  });
}

export function buildLostEmail(params: {
  lead: { name: string; company: string; quoteValue?: any };
  outcome: 'LOST' | 'DROPPED';
  reason: string;
  rep: string;
  competitor?: string;
  whatToImprove?: string;
  attachmentNames?: string[];
}) {
  const { lead, outcome, reason, rep, competitor, whatToImprove, attachmentNames = [] } = params;
  const isLost = outcome === 'LOST';
  const accent = isLost ? BRAND.negative : BRAND.neutralAccent;
  const verb = isLost ? 'lost' : 'dropped';
  const value = Number(lead.quoteValue) > 0 ? formatINR(lead.quoteValue) : '';

  return emailShell({
    preheader: `${esc(lead.company)} has been closed as ${verb}. Closure notes are recorded against the lead.`,
    title: `Opportunity ${verb} \u2014 ${esc(lead.company)}`,
    accentBar: accent,
    bodyHtml: `
      <p style="${P}">
        <strong style="color:${BRAND.ink}">${esc(lead.name)}</strong> at
        <strong style="color:${BRAND.ink}">${esc(lead.company)}</strong> has been closed as
        ${verb} by ${esc(rep)}. The closure notes below have been recorded against the lead.
      </p>

      ${value ? figureBlock('Value not realised', value, accent) : ''}

      ${detailTable([
        ['Opportunity', esc(lead.name)],
        ['Account', esc(lead.company)],
        !!competitor && ['Lost to', `<strong style="color:${accent}">${esc(competitor)}</strong>`],
        ['Closed by', esc(rep)],
        ['Outcome', `<strong style="color:${accent}">${isLost ? 'Lost' : 'Dropped'}</strong>`],
      ])}

      ${reason ? noteBlock(isLost ? 'Reason for the loss' : 'Reason for dropping', escMultiline(reason), accent) : ''}
      ${whatToImprove ? noteBlock('What to improve', escMultiline(whatToImprove), BRAND.caution) : ''}
      ${attachmentList(attachmentNames)}

      ${noticeBlock('neutral', `
        This opportunity is archived under <strong>Closed Leads</strong>, where the full history
        remains available for review.
      `)}
    `,
  });
}
