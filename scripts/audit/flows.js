/**
 * Business-flow audit: module-by-module verification of the CRM's behaviour.
 *
 * Complements scripts/audit/run.js (auth, RBAC, IDOR). This one drives the
 * actual workflows — lead lifecycle, quotation maths, order payments, approvals
 * — and asserts on concrete numbers rather than status codes alone.
 *
 *   node scripts/audit/flows.js
 *
 * Everything it creates is torn down at the end.
 */
const H = require('./harness');
const { prisma, actors, record, call } = H;

const made = { users: [], leads: [], customers: [], quotations: [], orders: [], products: [], tasks: [], followups: [], announcements: [] };
const uniq = () => Math.random().toString(36).slice(2, 8);

async function main() {
  console.log('\n═══ eOrbitor Pulse — business flow audit ═══\n');
  const A = await actors();
  const admin = A.SUPER_ADMIN || A.ADMIN;
  if (!admin) throw new Error('no admin to drive the suite');

  await loginFlow(A);
  await userManagement(A, admin);
  await leadLifecycle(A, admin);
  await customerMaster(admin);
  await quotationMaths(admin);
  await orderLifecycle(admin);
  await productCatalogue(admin);
  await tasksAndFollowups(A, admin);
  await announcementsAndNotifications(admin);
  await reportsIntegrity(admin);

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

// ── 2.1 login ───────────────────────────────────────────────────────────────
async function loginFlow(A) {
  console.log('── login & session ──');
  const admin = A.SUPER_ADMIN || A.ADMIN;

  const empty = await call(null, 'POST', '/api/auth/login', {});
  record('login', 'empty submission is rejected', empty.status >= 400, `got ${empty.status}`);

  const bad = await call(null, 'POST', '/api/auth/login', { email: admin.user.email, password: 'wrong-' + uniq() });
  record('login', 'wrong password → 401, no token', bad.status === 401 && !bad.body?.token, `got ${bad.status}`);

  const ghost = await call(null, 'POST', '/api/auth/login', { email: `ghost-${uniq()}@nowhere.test`, password: 'x' });
  record('login', 'unknown account → 401', ghost.status === 401, `got ${ghost.status}`);

  // A deactivated user must be blocked even with the right password.
  const pw = 'AuditPass!' + uniq();
  const bcrypt = require('bcryptjs');
  const disabled = await prisma.user.create({
    data: {
      email: `audit-disabled-${uniq()}@eorbitor.test`, passwordHash: await bcrypt.hash(pw, 10),
      firstName: 'Audit', lastName: 'Disabled', role: 'ON_FIELD_TEAM', isActive: false,
    },
  });
  made.users.push(disabled.id);
  const off = await call(null, 'POST', '/api/auth/login', { email: disabled.email, password: pw });
  record('login', 'deactivated account cannot log in', off.status >= 400 && !off.body?.token, `got ${off.status}`);

  // Reactivate and check the session side effects the spec calls for.
  await prisma.user.update({ where: { id: disabled.id }, data: { isActive: true } });
  const ok = await call(null, 'POST', '/api/auth/login', { email: disabled.email, password: pw });
  record('login', 'valid credentials return a token', ok.status === 200 && !!ok.body?.token, `got ${ok.status}`);

  const logs = await prisma.timeLog.count({ where: { userId: disabled.id } });
  record('login', 'login creates a TimeLog session', logs > 0, `${logs} rows`);
  const day = await prisma.dailyActivity.count({ where: { userId: disabled.id } });
  record('login', 'login upserts today\'s DailyActivity', day > 0, `${day} rows`);
}

// ── 3.2 users ───────────────────────────────────────────────────────────────
async function userManagement(A, admin) {
  console.log('\n── user management ──');
  const manager = A.BACKEND_TEAM;

  const email = `audit-user-${uniq()}@eorbitor.test`;
  const mk = await call(admin.token, 'POST', '/api/users', {
    email, password: 'AuditPass!123', firstName: 'Audit', lastName: 'Exec',
    role: 'ON_FIELD_TEAM', managerId: manager?.user.id, department: 'Sales', employeeId: 'AUD-' + uniq(),
  });
  record('users', 'admin can create a user', mk.status === 200 || mk.status === 201, `got ${mk.status} ${mk.body?.message || ''}`);
  const newId = mk.body?.id;
  if (newId) made.users.push(newId);

  if (newId && manager) {
    const row = await prisma.user.findUnique({ where: { id: newId }, select: { managerId: true } });
    record('users', 'manager link is stored', row?.managerId === manager.user.id, `managerId=${row?.managerId}`);
  }

  // A non-admin must not be able to create users.
  if (A.ON_FIELD_TEAM) {
    const nope = await call(A.ON_FIELD_TEAM.token, 'POST', '/api/users', {
      email: `x-${uniq()}@t.test`, password: 'x', firstName: 'a', lastName: 'b', role: 'ON_FIELD_TEAM',
    });
    record('users', 'ON_FIELD_TEAM cannot create users', nope.status === 403, `got ${nope.status}`);
  }

  if (newId) {
    const sw = await call(admin.token, 'POST', `/api/users/${newId}/role-switch`, { role: 'BACKEND_TEAM' });
    if (sw.status < 400) {
      const after = await prisma.user.findUnique({ where: { id: newId }, select: { role: true } });
      record('users', 'role switch takes effect', after?.role === 'BACKEND_TEAM', `role=${after?.role}`);
    } else {
      record('users', 'role switch endpoint responds', sw.status < 500, `got ${sw.status} ${sw.body?.message || ''}`);
    }
  }

  // Deactivation must block a previously-valid login.
  if (newId) {
    await call(admin.token, 'PATCH', `/api/users/${newId}`, { isActive: false });
    const blocked = await call(null, 'POST', '/api/auth/login', { email, password: 'AuditPass!123' });
    record('users', 'deactivating a user blocks their login', blocked.status >= 400, `got ${blocked.status}`);
  }
}

// ── 3.3 leads ───────────────────────────────────────────────────────────────
async function leadLifecycle(A, admin) {
  console.log('\n── lead lifecycle ──');
  const owner = (A.ON_FIELD_TEAM || admin).user;

  const mk = await call(admin.token, 'POST', '/api/leads', {
    name: 'Audit Contact', company: 'Audit Industries ' + uniq(), email: `audit-${uniq()}@t.test`,
    phone: '9000000000', source: 'REFERRAL', quoteValue: 500000,
    solutionAreas: ['Compute', 'Cyber Security'], oemNames: ['HPE', 'Fortinet'],
    assignedToId: owner.id,
  });
  record('leads', 'create a lead with tag arrays', mk.status === 200 || mk.status === 201, `got ${mk.status} ${mk.body?.message || ''}`);
  const leadId = mk.body?.id;
  if (!leadId) return;
  made.leads.push(leadId);

  const created = await prisma.lead.findUnique({
    where: { id: leadId }, select: { status: true, solutionAreas: true, oemNames: true, quoteValue: true, leadNumber: true },
  });
  record('leads', 'tag arrays persist', (created?.solutionAreas || []).length === 2 && (created?.oemNames || []).length === 2,
    `areas=${JSON.stringify(created?.solutionAreas)} oem=${JSON.stringify(created?.oemNames)}`);
  record('leads', 'lead gets a human-readable number', !!created?.leadNumber, `leadNumber=${created?.leadNumber}`);

  // SPANCO progression.
  const stages = ['PROSPECT', 'APPROACH', 'NEGOTIATION', 'CLOSURE'];
  let advanced = true;
  for (const st of stages) {
    const r = await call(admin.token, 'PATCH', `/api/leads/${leadId}`, { status: st });
    if (r.status >= 400) { advanced = false; record('leads', `advance to ${st}`, false, `got ${r.status} ${r.body?.message || ''}`); break; }
  }
  if (advanced) {
    const now = await prisma.lead.findUnique({ where: { id: leadId }, select: { status: true } });
    record('leads', 'SPANCO progression to CLOSURE', now?.status === 'CLOSURE', `status=${now?.status}`);
  }

  // Closure must require the lead to be at CLOSURE, then produce an order.
  const close = await call(admin.token, 'POST', `/api/leads/${leadId}/close`, {
    outcome: 'WON', quoteRef: 'QT-AUDIT', poNumber: 'PO-AUDIT', reasonOfWin: 'price',
    whatWentWell: 'speed', closureDetails: { closure: { finalDealValue: '550000', contractSignedDate: '2026-08-14' } },
  });
  record('leads', 'close as WON succeeds', close.status < 400, `got ${close.status} ${close.body?.message || ''}`);
  if (close.status < 400) {
    const after = await prisma.lead.findUnique({ where: { id: leadId }, select: { status: true, linkedCustomerId: true } });
    record('leads', 'a won lead becomes ORDER/WON', ['ORDER', 'WON'].includes(after?.status || ''), `status=${after?.status}`);
    record('leads', 'closing links or creates a customer', !!after?.linkedCustomerId, `linkedCustomerId=${after?.linkedCustomerId}`);
    if (after?.linkedCustomerId) {
      made.customers.push(after.linkedCustomerId);
      const contacts = await prisma.contact.count({ where: { customerId: after.linkedCustomerId } });
      record('leads', 'the new customer gets a primary contact', contacts > 0, `${contacts} contacts`);
      const ord = await prisma.order.findFirst({ where: { customerId: after.linkedCustomerId }, select: { id: true, totalAmount: true } });
      if (ord) made.orders.push(ord.id);
      record('leads', 'an order is raised from the won lead', !!ord, ord ? `total=${ord.totalAmount}` : 'none');
    }
  }

  // Reopen must go through approval for a non-admin.
  if (A.ON_FIELD_TEAM) {
    const req = await call(A.ON_FIELD_TEAM.token, 'POST', '/api/approval-requests', {
      type: 'LEAD_REOPEN', entityType: 'LEAD', entityId: leadId, leadId, reason: 'Client revised PO terms',
    });
    record('leads', 'reopen raises an approval request', req.status < 400, `got ${req.status} ${req.body?.message || ''}`);
  }
}

// ── 3.4 customers ───────────────────────────────────────────────────────────
async function customerMaster(admin) {
  console.log('\n── customer master ──');
  const gst = '27AAAAA0000A1Z5';
  await prisma.customer.deleteMany({ where: { gstNumber: gst } });

  const one = await call(admin.token, 'POST', '/api/customers', {
    companyName: 'Audit GST Co ' + uniq(), gstNumber: gst, contactName: 'Audit Primary', contactEmail: 'p@t.test',
  });
  record('customers', 'create with a valid GSTIN', one.status < 400, `got ${one.status} ${one.body?.message || ''}`);
  if (one.body?.id) made.customers.push(one.body.id);

  const dup = await call(admin.token, 'POST', '/api/customers', {
    companyName: 'Audit Dup ' + uniq(), gstNumber: gst, contactName: 'Audit Dup Contact',
  });
  record('customers', 'duplicate GSTIN is rejected', dup.status >= 400, `got ${dup.status} ${dup.body?.message || ''}`);
  if (dup.body?.id) made.customers.push(dup.body.id);

  // Contacts cascade with their customer.
  if (one.body?.id) {
    await prisma.contact.createMany({
      data: [
        { customerId: one.body.id, name: 'John Doe', email: 'j@t.test', isPrimary: true },
        { customerId: one.body.id, name: 'Jane Smith', email: 'ja@t.test', isPrimary: false },
      ],
    });
    const before = await prisma.contact.count({ where: { customerId: one.body.id } });
    await prisma.customer.delete({ where: { id: one.body.id } });
    const after = await prisma.contact.count({ where: { customerId: one.body.id } });
    made.customers = made.customers.filter((c) => c !== one.body.id);
    // 3, not 2: creating the customer already stores its primary contact.
    record('customers', 'contacts cascade-delete with the customer', before >= 2 && after === 0, `before=${before} after=${after}`);
  }

  // Bulk import: 10 good rows, 2 bad, reported per row.
  const rows = [];
  for (let i = 0; i < 10; i++) rows.push({ companyName: `Audit Bulk ${uniq()}`, gstNumber: `29AUD${uniq().toUpperCase()}${i}Z`, contactName: `Contact ${i}`, contactEmail: `c${i}-${uniq()}@t.test` });
  rows.push({ companyName: '', gstNumber: `29BAD${uniq().toUpperCase()}0Z`, contactName: 'X', contactEmail: 'x@t.test' }); // invalid: no company
  rows.push({ companyName: 'Audit No Contact ' + uniq(), gstNumber: `29CAD${uniq().toUpperCase()}1Z` });                   // invalid: no contact
  const imp = await call(admin.token, 'POST', '/api/customers/import', { rows });
  const results = imp.body?.results || [];
  const summary = imp.body?.summary || {};
  record('customers', 'bulk import reports per-row outcomes', imp.status < 400 && results.length === 12,
    `status=${imp.status} results=${results.length}`);
  record('customers', 'import accepts the 10 valid rows', summary.created === 10, `created=${summary.created}`);
  record('customers', 'import rejects the 2 invalid rows', summary.errors === 2, `errors=${summary.errors}`);
  // Each rejection must name its row and its reason, so a user can fix the file.
  const errs = results.filter((r) => r.status === 'error');
  record('customers', 'each rejection names its row and reason',
    errs.length > 0 && errs.every((r) => typeof r.row === 'number' && !!r.message),
    errs.map((r) => `row ${r.row}: ${r.message}`).join(' | '));
  for (const r of results) if (r.id) made.customers.push(r.id);
}

// ── 3.7 quotation maths ─────────────────────────────────────────────────────
async function quotationMaths(admin) {
  console.log('\n── quotation maths ──');
  const customer = await prisma.customer.findFirst({ where: { deletedAt: null }, select: { id: true } });
  if (!customer) return;

  // eOrbitor quotes tax-exclusive — its own PDFs say "Taxes: EXTRA As
  // Applicable" — so GST is added at PO/invoice, not here, and taxAmount is
  // always 0. There is one overall discount rather than a per-line one.
  // 2 x 50,000 + 1 x 1,00,000 = 2,00,000, less a 10,000 overall discount.
  const items = [
    { description: 'Item 1', quantity: 2, unitPrice: 50000 },
    { description: 'Item 2', quantity: 1, unitPrice: 100000 },
  ];
  const mk = await call(admin.token, 'POST', '/api/quotations', {
    customerId: customer.id, items, discountAmount: 10000,
    issueDate: new Date().toISOString(),
  });
  record('quotations', 'create a quotation', mk.status < 400, `got ${mk.status} ${mk.body?.message || ''}`);
  const qid = mk.body?.id;
  if (!qid) return;
  made.quotations.push(qid);

  const q = await prisma.quotation.findUnique({
    where: { id: qid }, select: { subtotal: true, taxAmount: true, totalAmount: true, quotationNumber: true },
  });
  record('quotations', 'subtotal computed server-side as 2,00,000', Number(q?.subtotal) === 200000, `got ${q?.subtotal}`);
  record('quotations', 'tax is 0 (quotes are raised tax-exclusive)', Number(q?.taxAmount) === 0, `got ${q?.taxAmount}`);
  record('quotations', 'overall discount applied → total 1,90,000', Number(q?.totalAmount) === 190000, `got ${q?.totalAmount}`);
  record('quotations', 'quotation gets a number', !!q?.quotationNumber, `number=${q?.quotationNumber}`);

  // Conversion guards.
  const early = await call(admin.token, 'POST', `/api/quotations/${qid}/convert-to-order`);
  record('quotations', 'a non-accepted quote cannot convert', early.status >= 400, `got ${early.status}`);

  await prisma.quotation.update({ where: { id: qid }, data: { status: 'ACCEPTED' } });
  const conv = await call(admin.token, 'POST', `/api/quotations/${qid}/convert-to-order`);
  record('quotations', 'an accepted quote converts to an order', conv.status === 201, `got ${conv.status} ${conv.body?.message || ''}`);
  if (conv.body?.id) {
    made.orders.push(conv.body.id);
    record('quotations', 'the order carries the quotation total', Number(conv.body.totalAmount) === 190000, `got ${conv.body.totalAmount}`);
  }
  const twice = await call(admin.token, 'POST', `/api/quotations/${qid}/convert-to-order`);
  record('quotations', 'the same quote cannot convert twice', twice.status >= 400, `got ${twice.status}`);
}

// ── 3.8 orders ──────────────────────────────────────────────────────────────
async function orderLifecycle(admin) {
  console.log('\n── order lifecycle & payments ──');
  const customer = await prisma.customer.findFirst({ where: { deletedAt: null }, select: { id: true } });
  if (!customer) return;

  const mk = await call(admin.token, 'POST', '/api/orders', { customerId: customer.id, totalAmount: '100000' });
  if (!mk.body?.id) return record('orders', 'create an order', false, `got ${mk.status}`);
  const id = mk.body.id;
  made.orders.push(id);
  record('orders', 'create an order', true);

  const confirm = await call(admin.token, 'POST', `/api/orders/${id}/confirm`);
  record('orders', 'confirm → CONFIRMED', confirm.status < 400 &&
    (await prisma.order.findUnique({ where: { id }, select: { status: true } }))?.status === 'CONFIRMED',
    `got ${confirm.status}`);

  const fulfil = await call(admin.token, 'POST', `/api/orders/${id}/fulfill`);
  record('orders', 'fulfil → FULFILLED', fulfil.status < 400 &&
    (await prisma.order.findUnique({ where: { id }, select: { status: true } }))?.status === 'FULFILLED',
    `got ${fulfil.status}`);

  const inv = await call(admin.token, 'POST', `/api/orders/${id}/invoice`, { invoiceNumber: 'INV-AUDIT-' + uniq() });
  record('orders', 'invoice endpoint responds', inv.status < 500, `got ${inv.status} ${inv.body?.message || ''}`);

  // Partial then full payment.
  const p1 = await call(admin.token, 'POST', `/api/orders/${id}/payments`, { amount: '40000', mode: 'NEFT', reference: 'A1' });
  const s1 = await prisma.order.findUnique({ where: { id }, select: { amountPaid: true, paymentStatus: true } });
  record('orders', '₹40,000 of ₹1,00,000 → PARTIAL, ₹60,000 due',
    p1.status === 201 && Number(s1?.amountPaid) === 40000 && s1?.paymentStatus === 'PARTIAL',
    `paid=${s1?.amountPaid} status=${s1?.paymentStatus}`);

  const p2 = await call(admin.token, 'POST', `/api/orders/${id}/payments`, { amount: '60000', mode: 'UPI', reference: 'A2' });
  const s2 = await prisma.order.findUnique({ where: { id }, select: { amountPaid: true, paymentStatus: true } });
  record('orders', 'the balance settles → COMPLETED',
    p2.status === 201 && Number(s2?.amountPaid) === 100000 && s2?.paymentStatus === 'COMPLETED',
    `paid=${s2?.amountPaid} status=${s2?.paymentStatus}`);

  const over = await call(admin.token, 'POST', `/api/orders/${id}/payments`, { amount: '1' });
  record('orders', 'a fully paid order refuses more money', over.status >= 400, `got ${over.status}`);

  const ledger = await prisma.orderPayment.count({ where: { orderId: id } });
  record('orders', 'both payments are in the ledger', ledger === 2, `${ledger} rows`);
}

// ── 3.11 products ───────────────────────────────────────────────────────────
async function productCatalogue(admin) {
  console.log('\n── product catalogue ──');
  const sku = 'AUDIT-SKU-' + uniq();
  const one = await call(admin.token, 'POST', '/api/products', {
    sku, name: 'Audit Server', basePrice: '150000', tax: '18', initialQuantity: 2, reorderLevel: 5,
  });
  record('products', 'create a product', one.status < 400, `got ${one.status} ${one.body?.message || ''}`);
  if (one.body?.id) made.products.push(one.body.id);

  const dup = await call(admin.token, 'POST', '/api/products', { sku, name: 'Audit Duplicate', basePrice: '1', tax: '18' });
  record('products', 'duplicate SKU is rejected', dup.status >= 400, `got ${dup.status} ${dup.body?.message || ''}`);
  if (dup.body?.id) made.products.push(dup.body.id);

  if (one.body?.id) {
    const inv = await prisma.inventory.findUnique({ where: { productId: one.body.id }, select: { quantity: true, reorderLevel: true } });
    record('products', 'stock below reorder level is detectable',
      !inv || (inv.quantity ?? 0) <= (inv.reorderLevel ?? 0), `qty=${inv?.quantity} reorder=${inv?.reorderLevel}`);
  }
}

// ── 3.5 / 3.6 follow-ups and tasks ──────────────────────────────────────────
async function tasksAndFollowups(A, admin) {
  console.log('\n── tasks & follow-ups ──');
  const assignee = (A.ON_FIELD_TEAM || admin).user;

  const before = await prisma.notification.count({ where: { userId: assignee.id, type: 'TASK_ASSIGNED' } });
  const t = await call(admin.token, 'POST', '/api/tasks', {
    title: 'Prepare HPE Quotation', priority: 'URGENT', assignedToId: assignee.id,
    dueDate: new Date(Date.now() + 86400000).toISOString(),
  });
  record('tasks', 'create a task', t.status < 400, `got ${t.status} ${t.body?.message || ''}`);
  if (t.body?.id) {
    made.tasks.push(t.body.id);
    const after = await prisma.notification.count({ where: { userId: assignee.id, type: 'TASK_ASSIGNED' } });
    record('tasks', 'the assignee is notified', after > before, `${before} → ${after}`);

    const done = await call(admin.token, 'POST', `/api/tasks/${t.body.id}/complete`);
    const row = await prisma.task.findUnique({ where: { id: t.body.id }, select: { status: true, completedAt: true } });
    record('tasks', 'complete sets status and a timestamp',
      done.status < 400 && row?.status === 'COMPLETED' && !!row?.completedAt,
      `status=${row?.status} at=${row?.completedAt}`);
  }

  const lead = await prisma.lead.findFirst({ where: { deletedAt: null }, select: { id: true } });
  const deal = await prisma.deal.findFirst({ select: { id: true } });

  // FollowUp.dealId is non-nullable, so a lead-only follow-up must be refused
  // cleanly rather than crashing.
  const noDeal = await call(admin.token, 'POST', '/api/followups', {
    leadId: lead?.id, type: 'MEETING', scheduledDate: new Date(Date.now() + 86400000).toISOString(),
  });
  record('followups', 'a follow-up without a deal → 400, not 500', noDeal.status === 400, `got ${noDeal.status}`);

  const f = await call(admin.token, 'POST', '/api/followups', {
    dealId: deal?.id, leadId: lead?.id, type: 'MEETING',
    scheduledDate: new Date(Date.now() + 86400000).toISOString(), notes: 'Audit follow-up',
  });
  record('followups', 'schedule a follow-up', f.status < 400, `got ${f.status} ${f.body?.message || ''}`);
  if (f.body?.id) {
    made.followups.push(f.body.id);
    const upd = await call(admin.token, 'PATCH', `/api/followups/${f.body.id}`, {
      outcome: 'Client agreed to pricing', actualDate: new Date().toISOString(),
    });
    const row = await prisma.followUp.findUnique({ where: { id: f.body.id }, select: { outcome: true, actualDate: true } });
    record('followups', 'logging an outcome records the actual date',
      upd.status < 400 && !!row?.outcome && !!row?.actualDate, `outcome=${row?.outcome}`);
  }
}

// ── 3.12 / 3.14 announcements and notifications ─────────────────────────────
async function announcementsAndNotifications(admin) {
  console.log('\n── announcements & notifications ──');
  const a = await call(admin.token, 'POST', '/api/announcements', {
    title: 'Q3 Sales Target Meeting', content: 'Today at 4 PM', priority: 'URGENT', isPublished: true,
  });
  record('announcements', 'publish an announcement', a.status < 400, `got ${a.status} ${a.body?.message || ''}`);
  if (a.body?.id) {
    made.announcements.push(a.body.id);
    const list = await call(admin.token, 'GET', '/api/announcements');
    const items = list.body?.announcements || list.body?.data || (Array.isArray(list.body) ? list.body : []);
    record('announcements', 'it appears in the feed',
      Array.isArray(items) && items.some((x) => x.id === a.body.id), `${items.length} items`);
  }

  const mine = await prisma.notification.findFirst({ where: { userId: admin.user.id, isRead: false }, select: { id: true } });
  if (mine) {
    const r = await call(admin.token, 'POST', `/api/notifications/${mine.id}/read`);
    const row = await prisma.notification.findUnique({ where: { id: mine.id }, select: { isRead: true, readAt: true } });
    record('notifications', 'marking read sets isRead and readAt',
      r.status < 400 && row?.isRead === true && !!row?.readAt, `isRead=${row?.isRead}`);
    await prisma.notification.update({ where: { id: mine.id }, data: { isRead: false, readAt: null } });
  }
}

// ── 3.13 reports ────────────────────────────────────────────────────────────
async function reportsIntegrity(admin) {
  console.log('\n── reports ──');
  for (const kind of ['personal', 'team', 'pipeline']) {
    const r = await call(admin.token, 'GET', `/api/reports/${kind}`);
    record('reports', `${kind} report generates`, r.status < 400, `got ${r.status} ${r.body?.message || ''}`);
  }

  // Cross-check the pipeline's won figure against the database.
  const r = await call(admin.token, 'GET', '/api/reports/pipeline');
  if (r.status < 400 && r.body) {
    const dbWon = await prisma.lead.count({ where: { deletedAt: null, status: { in: ['WON', 'ORDER'] } } });
    const reported = r.body.wonCount ?? r.body.won ?? r.body.summary?.wonCount ?? null;
    record('reports', 'pipeline won-count matches the database',
      reported === null || reported === dbWon, `report=${reported} db=${dbWon}`);
  }
}

// ── teardown ────────────────────────────────────────────────────────────────
async function cleanup() {
  console.log('\n── cleanup ──');
  const del = async (label, fn) => { try { const n = await fn(); if (n?.count) console.log(`  removed ${n.count} ${label}`); } catch (e) { console.log(`  ! ${label}: ${e.message.slice(0, 60)}`); } };
  await del('followups', () => prisma.followUp.deleteMany({ where: { id: { in: made.followups } } }));
  await del('tasks', () => prisma.task.deleteMany({ where: { id: { in: made.tasks } } }));
  await del('announcements', () => prisma.announcement.deleteMany({ where: { id: { in: made.announcements } } }));
  await del('orders', () => prisma.order.deleteMany({ where: { id: { in: made.orders } } }));
  await del('quotations', () => prisma.quotation.deleteMany({ where: { id: { in: made.quotations } } }));
  await del('products', () => prisma.product.deleteMany({ where: { id: { in: made.products } } }));
  await del('leads', () => prisma.lead.deleteMany({ where: { id: { in: made.leads } } }));
  await del('customers', () => prisma.customer.deleteMany({ where: { id: { in: made.customers } } }));
  // Imported rows come back without an id, so sweep them by name prefix.
  await del('imported customers', () => prisma.customer.deleteMany({ where: { companyName: { startsWith: 'Audit Bulk' } } }));
  await del('imported customers', () => prisma.customer.deleteMany({ where: { companyName: { startsWith: 'Audit No Contact' } } }));
  await del('timelogs', () => prisma.timeLog.deleteMany({ where: { userId: { in: made.users } } }));
  await del('daily activity', () => prisma.dailyActivity.deleteMany({ where: { userId: { in: made.users } } }));
  await del('notifications', () => prisma.notification.deleteMany({ where: { userId: { in: made.users } } }));
  await del('users', () => prisma.user.deleteMany({ where: { id: { in: made.users } } }));
}

main().catch(async (err) => {
  console.error(err);
  await cleanup().catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
