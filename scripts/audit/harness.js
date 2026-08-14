/**
 * End-to-end audit harness for eOrbitor Pulse.
 *
 * Exercises the running app as each role and reports what actually happens,
 * rather than what the code looks like it should do. Read-only by default:
 * every mutation it makes is recorded and rolled back in `cleanup()`.
 *
 *   node scripts/audit/harness.js            # read + access-matrix checks
 *   node scripts/audit/harness.js --mutate   # also run write/flow checks
 *
 * Requires the dev server on http://localhost:3000 and a seeded database.
 */
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const BASE = process.env.AUDIT_BASE || 'http://localhost:3000';
const MUTATE = process.argv.includes('--mutate');
const prisma = new PrismaClient();

// ── auth ────────────────────────────────────────────────────────────────────
function jwtSecret() {
  const line = fs
    .readFileSync(path.join(__dirname, '../../.env.local'), 'utf8')
    .split('\n')
    .find((l) => l.startsWith('JWT_SECRET='));
  if (!line) throw new Error('JWT_SECRET missing from .env.local');
  return line.slice('JWT_SECRET='.length).trim().replace(/^['"]|['"]$/g, '');
}

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'BACKEND_TEAM', 'ON_FIELD_TEAM'];

async function actors() {
  const secret = jwtSecret();
  const out = {};
  for (const role of ROLES) {
    const u = await prisma.user.findFirst({
      where: { role, isActive: true, deletedAt: null },
      select: { id: true, email: true, role: true, firstName: true, lastName: true },
    });
    if (!u) {
      console.log(`  ! no ${role} user — skipping that role`);
      continue;
    }
    out[role] = {
      user: u,
      token: jwt.sign(
        { id: u.id, email: u.email, role: u.role, firstName: u.firstName, lastName: u.lastName },
        secret,
        { expiresIn: '30m' }
      ),
    };
  }
  return out;
}

// ── results ─────────────────────────────────────────────────────────────────
const findings = [];
let checks = 0;
let failures = 0;

function record(area, name, ok, detail) {
  checks++;
  if (!ok) {
    failures++;
    findings.push({ area, name, detail });
  }
  const mark = ok ? 'ok  ' : 'FAIL';
  console.log(`  ${mark} ${name}${detail && !ok ? ` — ${detail}` : ''}`);
}

async function call(token, method, urlPath, body) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + urlPath, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* HTML error page */
  }
  return { status: res.status, body: json, raw: text };
}

module.exports = { prisma, BASE, MUTATE, ROLES, actors, record, call, findings, jwtSecret,
  summary: () => ({ checks, failures }) };
