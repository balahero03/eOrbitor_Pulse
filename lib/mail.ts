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

export async function sendMail(opts: {
  to: string | string[];
  subject: string;
  html: string;
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
    });
  } catch (err) {
    console.error('[MAIL ERROR]', err);
  }
}

export function buildWonEmail(lead: { name: string; company: string; quoteValue?: any }, rep: string, manager: string) {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#16a34a;color:#fff;padding:24px;border-radius:8px 8px 0 0">
        <h2 style="margin:0">🏆 Lead WON — ${lead.company}</h2>
      </div>
      <div style="background:#f0fdf4;padding:24px;border:1px solid #bbf7d0;border-radius:0 0 8px 8px">
        <p><strong>Opportunity:</strong> ${lead.name}</p>
        <p><strong>Company:</strong> ${lead.company}</p>
        ${lead.quoteValue ? `<p><strong>Deal Value:</strong> ₹${Number(lead.quoteValue).toLocaleString('en-IN')}</p>` : ''}
        <p><strong>Closed by:</strong> ${rep}</p>
        <p><strong>Manager:</strong> ${manager}</p>
        <hr style="border:none;border-top:1px solid #bbf7d0;margin:16px 0"/>
        <p style="color:#166534;font-size:14px">This lead has been moved to <strong>Orders</strong>. Please proceed with order creation.</p>
      </div>
    </div>`;
}

export function buildLostEmail(
  lead: { name: string; company: string },
  outcome: 'LOST' | 'DROPPED',
  reason: string,
  rep: string,
) {
  const isLost = outcome === 'LOST';
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:${isLost ? '#dc2626' : '#6b7280'};color:#fff;padding:24px;border-radius:8px 8px 0 0">
        <h2 style="margin:0">${isLost ? '❌ Lead LOST' : '🚫 Lead DROPPED'} — ${lead.company}</h2>
      </div>
      <div style="background:${isLost ? '#fef2f2' : '#f9fafb'};padding:24px;border:1px solid ${isLost ? '#fecaca' : '#e5e7eb'};border-radius:0 0 8px 8px">
        <p><strong>Opportunity:</strong> ${lead.name}</p>
        <p><strong>Company:</strong> ${lead.company}</p>
        <p><strong>Outcome:</strong> ${outcome}</p>
        <p><strong>Reason:</strong> ${reason || 'Not specified'}</p>
        <p><strong>Closed by:</strong> ${rep}</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0"/>
        <p style="color:#374151;font-size:14px">This lead has been archived. You may follow up later from the <strong>Closed Leads</strong> section.</p>
      </div>
    </div>`;
}
