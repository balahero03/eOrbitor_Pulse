/**
 * Browser end-to-end audit.
 *
 * The API suites (run.js, flows.js) prove the server behaves. This one drives a
 * real browser, which is the only way to catch the class of defect they cannot
 * see: a page that throws on render, a button that is never wired up, a form
 * that blocks a legitimate submission, a nav link that 404s, a layout that
 * overflows on a phone.
 *
 *   node scripts/audit/e2e.js            # headless
 *   node scripts/audit/e2e.js --headed   # watch it run
 *
 * Uses the system Chrome (`channel: 'chrome'`) so no browser download is
 * needed. Read-only: it navigates and inspects, and opens modals without
 * submitting anything that would write.
 */
const { chromium } = require('@playwright/test');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const BASE = process.env.AUDIT_BASE || 'http://localhost:3000';
const HEADED = process.argv.includes('--headed');
const prisma = new PrismaClient();

let checks = 0, failures = 0;
const findings = [];
function record(area, name, ok, detail) {
  checks++;
  if (!ok) { failures++; findings.push({ area, name, detail }); }
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? ` — ${detail}` : ''}`);
}

function jwtSecret() {
  const line = fs.readFileSync(path.join(__dirname, '../../.env.local'), 'utf8')
    .split('\n').find((l) => l.startsWith('JWT_SECRET='));
  return line.slice('JWT_SECRET='.length).trim().replace(/^['"]|['"]$/g, '');
}

/** Pages every signed-in user should be able to open. */
const PAGES = [
  '/dashboard', '/leads', '/closed-leads', '/customers', '/orders', '/quotations',
  '/products', '/tasks', '/followups', '/reports', '/daily-activity',
  '/attendance', '/approvals', '/announcements', '/users', '/profile',
];

async function main() {
  console.log('\n═══ eOrbitor Pulse — browser E2E audit ═══');
  console.log(`base: ${BASE}   mode: ${HEADED ? 'headed' : 'headless'}\n`);

  const browser = await chromium.launch({ headless: !HEADED, channel: 'chrome' });
  try {
    await loginScreen(browser);
    await sessionPages(browser);
    await mobileLayout(browser);
    await deadLinks(browser);
  } finally {
    await browser.close();
  }

  console.log(`\n═══ ${checks - failures}/${checks} passed, ${failures} failed ═══`);
  if (findings.length) {
    console.log('\nFindings:');
    for (const f of findings) console.log(`  [${f.area}] ${f.name}\n      ${f.detail}`);
  }
  await prisma.$disconnect();
  process.exit(failures ? 1 : 0);
}

/** A page context that is already signed in, by seeding the token. */
async function signedIn(browser, user) {
  const ctx = await browser.newContext();
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName },
    jwtSecret(), { expiresIn: '30m' }
  );
  await ctx.addInitScript(([t, u]) => {
    localStorage.setItem('token', t);
    localStorage.setItem('user', u);
  }, [token, JSON.stringify(user)]);
  return ctx;
}

/** Console errors and failed requests, collected per page. */
function watch(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.split('\n')[0]}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 120)}`); });
  page.on('response', (r) => {
    const u = r.url();
    if (u.includes('/api/') && r.status() >= 500) errors.push(`${r.status()} ${u.replace(BASE, '')}`);
  });
  return errors;
}

// ── 2.1 the login screen, actually clicked ──────────────────────────────────
async function loginScreen(browser) {
  console.log('── login screen ──');
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = watch(page);

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  record('login', 'the login page renders', !/Application error|__next_error/.test(await page.content()));

  const email = page.locator('input[type="email"], input[name="email"]').first();
  const pass = page.locator('input[type="password"]').first();
  const submit = page.locator('button[type="submit"]').first();
  record('login', 'email, password and submit are present',
    (await email.count()) > 0 && (await pass.count()) > 0 && (await submit.count()) > 0);

  // Empty submission must not navigate away or throw.
  await submit.click().catch(() => {});
  await page.waitForTimeout(600);
  record('login', 'empty submit stays on /login', page.url().includes('/login'), `url=${page.url()}`);

  // Wrong credentials must surface a visible message, not a silent failure.
  await email.fill('nobody@nowhere.test');
  await pass.fill('wrong-password');
  await submit.click();
  await page.waitForTimeout(1800);
  const body = await page.locator('body').innerText();
  record('login', 'bad credentials show a visible error',
    /invalid|incorrect|wrong|not found|failed|error/i.test(body), 'no message found on screen');
  record('login', 'bad credentials do not navigate away', page.url().includes('/login'), `url=${page.url()}`);

  const forgot = page.locator('a[href*="forgot"], a:has-text("Forgot")');
  record('login', 'the forgot-password link exists', (await forgot.count()) > 0);
  if (await forgot.count()) {
    await forgot.first().click();
    await page.waitForTimeout(1200);
    record('login', 'it navigates to the reset flow', /forgot|reset/.test(page.url()), `url=${page.url()}`);
  }

  // The deliberate bad-credentials attempt above logs an expected 401; only
  // genuine faults should fail this check.
  const realErrors = errors.filter((e) => !/401|Unauthorized/.test(e));
  record('login', 'no uncaught JS errors on the login screen', realErrors.length === 0, realErrors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ── every page, for every role ──────────────────────────────────────────────
async function sessionPages(browser) {
  console.log('\n── every page renders, per role ──');
  for (const role of ['SUPER_ADMIN', 'ADMIN', 'BACKEND_TEAM', 'ON_FIELD_TEAM']) {
    const user = await prisma.user.findFirst({
      where: { role, isActive: true, deletedAt: null },
      select: { id: true, email: true, role: true, firstName: true, lastName: true },
    });
    if (!user) { console.log(`  (no ${role} user)`); continue; }

    const ctx = await signedIn(browser, user);
    const page = await ctx.newPage();
    const errors = watch(page);
    const broken = [];

    for (const p of PAGES) {
      try {
        const res = await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(450);
        const html = await page.content();
        const crashed = /Application error|__next_error|Unhandled Runtime/.test(html);
        // A role-gated page redirecting to /dashboard is correct, not broken.
        if (crashed || (res && res.status() >= 500)) broken.push(`${p} (${res?.status()}${crashed ? ', render crash' : ''})`);
      } catch (e) {
        broken.push(`${p} (${e.message.split('\n')[0].slice(0, 40)})`);
      }
    }
    record('pages', `${role}: all ${PAGES.length} pages render`, broken.length === 0, broken.join(', '));
    const fatal = errors.filter((e) => e.startsWith('pageerror') || /^5\d\d /.test(e));
    record('pages', `${role}: no page errors or 5xx`, fatal.length === 0, fatal.slice(0, 3).join(' | '));
    await ctx.close();
  }
}

// ── phone layout: nothing may overflow horizontally ─────────────────────────
async function mobileLayout(browser) {
  console.log('\n── phone layout (390x844) ──');
  const admin = await prisma.user.findFirst({
    where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] }, isActive: true },
    select: { id: true, email: true, role: true, firstName: true, lastName: true },
  });
  const ctx = await signedIn(browser, admin);
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 390, height: 844 });

  const overflowing = [];
  for (const p of PAGES) {
    try {
      await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(500);
      // The page body must never scroll sideways on a phone.
      const over = await page.evaluate(() =>
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth
      );
      if (over > 8) overflowing.push(`${p} (+${over}px)`);
    } catch { /* covered by the render pass */ }
  }
  record('mobile', 'no page scrolls horizontally at 390px', overflowing.length === 0, overflowing.join(', '));
  await ctx.close();
}

// ── sidebar navigation must not lead anywhere broken ────────────────────────
async function deadLinks(browser) {
  console.log('\n── navigation ──');
  const admin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN', isActive: true },
    select: { id: true, email: true, role: true, firstName: true, lastName: true },
  });
  const ctx = await signedIn(browser, admin);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });

  const hrefs = await page.evaluate(() =>
    [...new Set([...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute('href')))]
      .filter((h) => h && !h.startsWith('/api') && !h.includes('#'))
  );
  record('nav', 'the shell exposes navigation links', hrefs.length > 0, `${hrefs.length} links`);

  const dead = [];
  for (const h of hrefs.slice(0, 25)) {
    try {
      const res = await page.goto(BASE + h, { waitUntil: 'domcontentloaded', timeout: 15000 });
      if (res && res.status() >= 400) dead.push(`${h} → ${res.status()}`);
    } catch (e) { dead.push(`${h} → ${e.message.split('\n')[0].slice(0, 30)}`); }
  }
  record('nav', 'no navigation link is dead', dead.length === 0, dead.join(', '));
  await ctx.close();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
