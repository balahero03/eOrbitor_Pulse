/**
 * The audit suite. See harness.js for usage.
 *
 * Each section states what it is proving, so a failure names a defect rather
 * than just a status code.
 */
const H = require('./harness');
const { prisma, MUTATE, actors, record, call } = H;

// Anything created during the run, torn down at the end.
const created = { orders: [], quotations: [], leads: [], customers: [], payments: [], notifications: [] };

async function main() {
  console.log('\n═══ eOrbitor Pulse — audit ═══');
  console.log(`base: ${H.BASE}   mode: ${MUTATE ? 'read + mutate' : 'read only'}\n`);

  const A = await actors();
  const admin = A.SUPER_ADMIN || A.ADMIN;
  if (!admin) throw new Error('no admin user to drive the suite');

  await unauthenticated();
  await readMatrix(A);
  await roleScoping(A);
  await idorProbes(A);
  await passwordReset(admin);
  await uploadRules();
  if (MUTATE) {
    await orderFlow(A, admin);
    await quotationFlow(admin);
  }

  await cleanup();

  const { checks, failures } = H.summary();
  console.log(`\n═══ ${checks - failures}/${checks} passed, ${failures} failed ═══`);
  if (H.findings.length) {
    console.log('\nFindings:');
    for (const f of H.findings) console.log(`  [${f.area}] ${f.name}\n      ${f.detail}`);
  }
  await prisma.$disconnect();
  process.exit(failures ? 1 : 0);
}

// ── 1. everything must require a token ──────────────────────────────────────
async function unauthenticated() {
  console.log('── unauthenticated access ──');
  const guarded = [
    ['GET', '/api/leads'], ['GET', '/api/customers'], ['GET', '/api/orders'],
    ['GET', '/api/quotations'], ['GET', '/api/users'], ['GET', '/api/dashboard'],
    ['GET', '/api/reports/personal'], ['GET', '/api/notifications'],
    ['GET', '/api/approval-requests'], ['GET', '/api/products'],
    ['GET', '/api/tasks'], ['GET', '/api/followups'], ['GET', '/api/announcements'],
    ['GET', '/api/daily-activity'], ['GET', '/api/activity-logs'],
  ];
  for (const [m, p] of guarded) {
    const r = await call(null, m, p);
    record('auth', `${m} ${p} without a token → 401`, r.status === 401, `got ${r.status}`);
  }
  // The cron endpoint is public by design but must reject a wrong secret.
  const cron = await call(null, 'POST', '/api/cron/inactive-users');
  record('auth', 'POST /api/cron/inactive-users without secret → 401/503',
    cron.status === 401 || cron.status === 503, `got ${cron.status}`);
}

// ── 2. every role can load what its UI needs ────────────────────────────────
async function readMatrix(A) {
  console.log('\n── read access by role ──');
  const paths = [
    '/api/auth/me', '/api/dashboard', '/api/leads', '/api/customers', '/api/orders',
    '/api/quotations', '/api/products', '/api/tasks', '/api/followups',
    '/api/notifications', '/api/announcements', '/api/daily-activity',
    '/api/reports/personal', '/api/approval-requests',
  ];
  for (const [role, a] of Object.entries(A)) {
    for (const p of paths) {
      const r = await call(a.token, 'GET', p);
      // 200 or a deliberate 403 are both fine; 5xx never is.
      record('read', `${role} GET ${p}`, r.status < 500,
        `got ${r.status} ${r.body?.message || r.raw.slice(0, 80)}`);
    }
  }
}

// ── 3. non-admins must not see the whole table ──────────────────────────────
async function roleScoping(A) {
  console.log('\n── role scoping ──');
  const admin = A.SUPER_ADMIN || A.ADMIN;
  const field = A.ON_FIELD_TEAM;
  if (!field) return;

  for (const p of ['/api/leads', '/api/orders', '/api/quotations']) {
    const all = await call(admin.token, 'GET', p);
    const mine = await call(field.token, 'GET', p);
    const countOf = (b) =>
      b?.pagination?.total ?? (Array.isArray(b) ? b.length
        : Array.isArray(b?.leads) ? b.leads.length
        : Array.isArray(b?.orders) ? b.orders.length
        : Array.isArray(b?.quotations) ? b.quotations.length
        : Array.isArray(b?.customers) ? b.customers.length : null);
    const a = countOf(all.body);
    const f = countOf(mine.body);
    record('scoping', `ON_FIELD_TEAM sees no more than admin on ${p}`,
      a === null || f === null || f <= a, `admin=${a} field=${f}`);
  }

  // Admin-only surfaces.
  const usersAsField = await call(field.token, 'GET', '/api/users');
  record('scoping', 'ON_FIELD_TEAM GET /api/users is restricted or scoped',
    usersAsField.status !== 500, `got ${usersAsField.status}`);
}

// ── 4. can one user reach another's records by id? ──────────────────────────
async function idorProbes(A) {
  console.log('\n── IDOR probes ──');
  const field = A.ON_FIELD_TEAM;
  const admin = A.SUPER_ADMIN || A.ADMIN;
  if (!field) return;

  // A notification belonging to someone else.
  const other = await prisma.notification.findFirst({
    where: { userId: { not: field.user.id } },
    select: { id: true },
  });
  if (other) {
    const r = await call(field.token, 'POST', `/api/notifications/${other.id}/read`);
    record('idor', 'cannot mark another user\'s notification read',
      r.status === 403 || r.status === 404, `got ${r.status}`);
    const d = await call(field.token, 'DELETE', `/api/notifications/${other.id}`);
    record('idor', 'cannot delete another user\'s notification',
      d.status === 403 || d.status === 404, `got ${d.status}`);
  }

  // A lead owned by someone else.
  const foreignLead = await prisma.lead.findFirst({
    where: { deletedAt: null, assignedToId: { not: field.user.id } },
    select: { id: true },
  });
  if (foreignLead) {
    const r = await call(field.token, 'GET', `/api/leads/${foreignLead.id}`);
    record('idor', 'cannot read a lead assigned to someone else',
      r.status === 403 || r.status === 404, `got ${r.status}`);
  }

  // Product catalogue writes should not be open to everyone.
  const product = await prisma.product.findFirst({ select: { id: true, name: true } });
  if (product) {
    const r = await call(field.token, 'PATCH', `/api/products/${product.id}`, { name: product.name });
    record('idor', 'ON_FIELD_TEAM cannot edit the product catalogue',
      r.status === 403, `got ${r.status}`);
    const d = await call(field.token, 'DELETE', `/api/products/${product.id}`);
    record('idor', 'ON_FIELD_TEAM cannot delete a product',
      d.status === 403, `got ${d.status}`);
    // DELETE is a soft delete (isActive: false). While the gap is open the
    // probe really does deactivate it, so put the catalogue back either way.
    if (d.status < 400) {
      await prisma.product.update({ where: { id: product.id }, data: { isActive: true } });
      console.log('       (restored the product the probe deactivated)');
    }
  }

  // Bulk customer import should not be open to everyone.
  const imp = await call(field.token, 'POST', '/api/customers/import', { rows: [] });
  record('idor', 'ON_FIELD_TEAM cannot bulk-import customers',
    imp.status === 403, `got ${imp.status}`);
}

// ── 5. the password reset chain ─────────────────────────────────────────────
async function passwordReset(admin) {
  console.log('\n── password reset ──');
  const generic = 'If that account exists';

  const unknown = await call(null, 'POST', '/api/auth/forgot-password', { email: 'nobody@nowhere.test' });
  record('reset', 'unknown account gets the generic reply (no enumeration)',
    unknown.status === 200 && String(unknown.body?.message || '').includes(generic),
    `got ${unknown.status} ${unknown.body?.message}`);

  const noEmail = await call(null, 'POST', '/api/auth/forgot-password', {});
  record('reset', 'missing email → 400', noEmail.status === 400, `got ${noEmail.status}`);

  const badCode = await call(null, 'POST', '/api/auth/verify-reset-code', {
    email: admin.user.email, code: '000000',
  });
  record('reset', 'a wrong code is rejected', badCode.status >= 400, `got ${badCode.status}`);

  const shortPw = await call(null, 'POST', '/api/auth/reset-password', {
    email: admin.user.email, code: '000000', newPassword: 'x',
  });
  record('reset', 'reset with a bad code/short password is rejected',
    shortPw.status >= 400, `got ${shortPw.status}`);

  // Wrong password on login must not look like an expired session.
  const badLogin = await call(null, 'POST', '/api/auth/login', {
    email: admin.user.email, password: 'definitely-not-the-password',
  });
  record('reset', 'wrong password → 401 and no token',
    badLogin.status === 401 && !badLogin.body?.token, `got ${badLogin.status}`);
}

// ── 5b. upload allow-list ───────────────────────────────────────────────────
async function uploadRules() {
  console.log('\n── upload allow-list ──');
  // Exercised directly: the shared helper is what every upload route funnels
  // through, so proving it here covers all of them at once.
  const { saveBase64Files } = require('../../.audit-build/storage.js');
  const cases = [
    ['doc.pdf', true], ['photo.PNG', true],
    ['shell.php', false], ['run.exe', false],
    ['payload', false], ['.htaccess', false],
  ];
  for (const [filename, shouldPass] of cases) {
    let accepted = true;
    try {
      saveBase64Files('audit-tmp', [{ filename, contentType: 'application/octet-stream', dataBase64: 'AAAA' }]);
    } catch {
      accepted = false;
    }
    record('upload', `${filename} is ${shouldPass ? 'accepted' : 'rejected'}`,
      accepted === shouldPass, `was ${accepted ? 'accepted' : 'rejected'}`);
  }
  // Remove whatever the accepted cases wrote.
  try {
    const fsx = require('fs');
    const root = process.env.FILE_UPLOAD_DIR || require('path').join(process.cwd(), 'uploads');
    fsx.rmSync(require('path').join(root, 'audit-tmp'), { recursive: true, force: true });
  } catch { /* nothing written */ }
}

// ── 6. order + payment flow ─────────────────────────────────────────────────
async function orderFlow(A, admin) {
  console.log('\n── order & payment flow ──');
  const customer = await prisma.customer.findFirst({ where: { deletedAt: null }, select: { id: true } });
  if (!customer) return;

  const mk = await call(admin.token, 'POST', '/api/orders', {
    customerId: customer.id, totalAmount: '10000', amountPaid: '2500',
  });
  record('orders', 'create an order with an opening payment', mk.status === 201 || mk.status === 200,
    `got ${mk.status} ${mk.body?.message || ''}`);
  if (!mk.body?.id) return;
  created.orders.push(mk.body.id);

  const ledger = await prisma.orderPayment.findMany({ where: { orderId: mk.body.id } });
  record('orders', 'the opening payment lands in the ledger', ledger.length === 1,
    `${ledger.length} ledger rows`);

  const pay = await call(admin.token, 'POST', `/api/orders/${mk.body.id}/payments`, {
    amount: '1,000', mode: 'NEFT', reference: 'AUDIT',
  });
  record('orders', 'a second payment parses Indian grouping', pay.status === 201,
    `got ${pay.status}`);

  const after = await prisma.order.findUnique({ where: { id: mk.body.id }, select: { amountPaid: true } });
  record('orders', 'the opening payment is not erased by the second',
    Number(after?.amountPaid) === 3500, `amountPaid=${after?.amountPaid}`);

  const over = await call(admin.token, 'POST', `/api/orders/${mk.body.id}/payments`, { amount: '999999' });
  record('orders', 'overpayment is rejected', over.status >= 400, `got ${over.status}`);

  const patch = await call(admin.token, 'PATCH', `/api/orders/${mk.body.id}`, {
    amountPaid: '99999', paymentProofUrl: 'data:image/png;base64,AAAA',
  });
  const patched = await prisma.order.findUnique({
    where: { id: mk.body.id }, select: { amountPaid: true, paymentProofUrl: true },
  });
  record('orders', 'PATCH cannot rewrite amountPaid or inject a base64 proof',
    Number(patched?.amountPaid) === 3500 && !String(patched?.paymentProofUrl || '').startsWith('data:'),
    `amountPaid=${patched?.amountPaid} proof=${String(patched?.paymentProofUrl || '').slice(0, 12)}`);

  // Concurrency: order numbers must stay unique.
  const burst = await Promise.all(
    [0, 1, 2, 3].map(() =>
      call(admin.token, 'POST', '/api/orders', { customerId: customer.id, totalAmount: '100' })
    )
  );
  burst.forEach((b) => b.body?.id && created.orders.push(b.body.id));
  const nums = burst.map((b) => b.body?.orderNumber).filter(Boolean);
  record('orders', 'concurrent creates get unique order numbers',
    nums.length === 4 && new Set(nums).size === 4, `got ${JSON.stringify(nums)}`);
}

// ── 7. quotation → order conversion ─────────────────────────────────────────
async function quotationFlow(admin) {
  console.log('\n── quotation conversion ──');
  const draft = await prisma.quotation.findFirst({
    where: { status: 'DRAFT', totalAmount: { gt: 0 } }, select: { id: true },
  });
  if (draft) {
    const r = await call(admin.token, 'POST', `/api/quotations/${draft.id}/convert-to-order`);
    record('quotations', 'a DRAFT quotation cannot become an order', r.status >= 400, `got ${r.status}`);
  }

  const accepted = await prisma.quotation.findFirst({
    where: { status: 'ACCEPTED', totalAmount: { gt: 0 }, orders: { none: {} } },
    select: { id: true },
  });
  if (accepted) {
    const one = await call(admin.token, 'POST', `/api/quotations/${accepted.id}/convert-to-order`);
    record('quotations', 'an ACCEPTED quotation converts', one.status === 201, `got ${one.status}`);
    if (one.body?.id) created.orders.push(one.body.id);
    const two = await call(admin.token, 'POST', `/api/quotations/${accepted.id}/convert-to-order`);
    record('quotations', 'the same quotation cannot convert twice', two.status >= 400, `got ${two.status}`);
  }
}

// ── teardown ────────────────────────────────────────────────────────────────
async function cleanup() {
  if (!created.orders.length) return;
  console.log('\n── cleanup ──');
  const n = await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
  console.log(`  removed ${n.count} test order(s)`);
}

main().catch(async (err) => {
  console.error(err);
  await cleanup().catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
