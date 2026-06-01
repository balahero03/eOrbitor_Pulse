import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PROTOCOL === 'ssl',
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  } : undefined,
  tls: { rejectUnauthorized: false },
});

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export async function sendMail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: MailAttachment[];
}) {
  if (!process.env.SMTP_HOST) {
    console.log('[MAIL - no SMTP configured] To:', opts.to, '| Subject:', opts.subject);
    return;
  }
  try {
    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'eOrbitor Pulse'}" <${process.env.SMTP_FROM_EMAIL || 'crm@eorbitor.local'}>`,
      to: Array.isArray(opts.to) ? opts.to.join(', ') : opts.to,
      subject: opts.subject,
      html: opts.html,
      attachments: opts.attachments?.map(a => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
  } catch (err) {
    console.error('[MAIL ERROR]', err);
  }
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
