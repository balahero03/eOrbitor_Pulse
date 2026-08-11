#!/usr/bin/env node
/**
 * SMTP connectivity check.
 *
 * Diagnosing mail from inside the app is slow and indirect — you have to drive
 * the whole profile flow and then read server logs. This talks to the configured
 * SMTP server directly and reports exactly what failed, so a misconfiguration is
 * a ten-second check instead of a guessing game.
 *
 *   npm run mail:test                  # verify the connection/credentials only
 *   npm run mail:test you@example.com  # ...and actually deliver a test message
 */
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

// The app relies on Next to load .env.local; a standalone script has to do it
// itself, and the project has no dotenv dependency to lean on.
function loadEnvFile(file) {
  const full = path.join(__dirname, '..', file);
  if (!fs.existsSync(full)) return;
  for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (!m) continue;
    const key = m[1];
    if (process.env[key] !== undefined) continue; // first file wins
    let raw = m[2].trim();
    // These files carry trailing comments (`SMTP_PROTOCOL="tls"  # tls, ssl`).
    // A quoted value ends at its closing quote; an unquoted one ends at the
    // first `#`. Getting this wrong silently mis-reads values like the
    // protocol, which decides whether the connection is implicit TLS.
    const quoted = raw.match(/^(["'])(.*?)\1/);
    raw = quoted ? quoted[2] : raw.split('#')[0].trim();
    process.env[key] = raw;
  }
}
loadEnvFile('.env.local');
loadEnvFile('.env');

const { SMTP_HOST, SMTP_PORT, SMTP_PROTOCOL, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_EMAIL, SMTP_FROM_NAME, APP_URL } = process.env;

const PLACEHOLDERS = ['smtp.company.local', 'localhost', ''];

console.log('\n  SMTP configuration');
console.log('  ─────────────────────────────────────────────');
console.log(`  host      ${SMTP_HOST || '(unset)'}`);
console.log(`  port      ${SMTP_PORT || '(unset)'}`);
console.log(`  protocol  ${SMTP_PROTOCOL || '(unset)'}`);
console.log(`  user      ${SMTP_USER || '(unset)'}`);
console.log(`  password  ${SMTP_PASSWORD ? `set (${SMTP_PASSWORD.length} chars)` : '(unset)'}`);
console.log(`  from      ${SMTP_FROM_EMAIL || '(unset)'}`);
console.log(`  APP_URL   ${APP_URL || '(unset)'}   <- emailed links point here in production`);
console.log('');

if (PLACEHOLDERS.includes((SMTP_HOST || '').trim())) {
  console.error(`  ✗ SMTP_HOST is "${SMTP_HOST || 'unset'}" — still the placeholder from .env.local.example.`);
  console.error('    No mail can be delivered until this points at a real server.\n');
  process.exit(1);
}

// Catch the half-configured state explicitly. Left alone, unfilled placeholders
// surface as a bare "535 authentication failed", which reads like wrong
// credentials rather than absent ones and sends you debugging the wrong thing.
const unfilled = [
  ['SMTP_USER', SMTP_USER],
  ['SMTP_PASSWORD', SMTP_PASSWORD],
].filter(([, v]) => !v || /^PASTE_/.test(v));

if (unfilled.length) {
  console.error(`  ✗ Not configured yet: ${unfilled.map(([k]) => k).join(' and ')} still hold placeholder text.\n`);
  if (/brevo/i.test(SMTP_HOST)) {
    console.error('    In Brevo, open  SMTP & API  ->  SMTP  tab:');
    console.error('      SMTP_USER      the "Login" shown there (an @smtp-brevo.com address,');
    console.error('                     not your account email)');
    console.error('      SMTP_PASSWORD  click "Generate a new SMTP key" and copy it');
    console.error('    Also confirm SMTP_FROM_EMAIL is verified under  Senders, Domains & IPs.\n');
  }
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: parseInt(SMTP_PORT || '587'),
  secure: SMTP_PROTOCOL === 'ssl',
  auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined,
  tls: { rejectUnauthorized: false },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

const recipient = process.argv[2];

(async () => {
  try {
    process.stdout.write('  Connecting and authenticating... ');
    await transporter.verify();
    console.log('OK');
  } catch (err) {
    console.log('FAILED');
    console.error(`\n  ✗ ${err.message}\n`);
    const code = err.code || '';
    if (code === 'ENOTFOUND') console.error('    The hostname does not resolve — check SMTP_HOST for a typo.\n');
    else if (code === 'ETIMEDOUT' || code === 'ESOCKET') console.error('    Reachability problem — check the port, or whether a firewall blocks outbound SMTP.\n');
    else if (code === 'EAUTH') console.error('    Credentials rejected — check SMTP_USER / SMTP_PASSWORD.\n');
    process.exit(1);
  }

  if (!recipient) {
    console.log('\n  ✓ SMTP is configured correctly.');
    console.log('    Pass an address to also send a real test message:');
    console.log('      npm run mail:test you@example.com\n');
    return;
  }

  try {
    process.stdout.write(`  Sending a test message to ${recipient}... `);
    const info = await transporter.sendMail({
      from: `"${SMTP_FROM_NAME || 'eOrbitor Pulse'}" <${SMTP_FROM_EMAIL || SMTP_USER}>`,
      to: recipient,
      subject: 'eOrbitor Pulse — SMTP test',
      html: `<div style="font-family:Arial,sans-serif;max-width:520px">
        <h2 style="color:#2563eb;margin:0 0 12px">SMTP is working</h2>
        <p style="font-size:14px;color:#374151;line-height:1.6">
          If you're reading this, eOrbitor Pulse can send mail. Password reset and
          email verification links will now be delivered.
        </p>
        <p style="font-size:12px;color:#9ca3af">Sent by <code>npm run mail:test</code></p>
      </div>`,
    });
    console.log('OK');
    console.log(`\n  ✓ Delivered (message id ${info.messageId}).`);
    console.log('    Check the inbox — and the spam folder, for a first send from a new sender.\n');
  } catch (err) {
    console.log('FAILED');
    console.error(`\n  ✗ ${err.message}\n`);
    process.exit(1);
  }
})();
