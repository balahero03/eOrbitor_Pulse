/**
 * Repair orders that were created without a value.
 *
 * Until this was fixed, POST /api/leads/[id]/close built the order from the
 * accepted quotation, falling back to `lead.quoteValue` — and never read the
 * Final Deal Value the rep had just been *required* to enter on the closure
 * form. A lead with neither a linked quotation nor a quoteValue therefore
 * produced a ₹0 order, which blocks every downstream action: no balance, no
 * payment can be recorded, nothing to chase.
 *
 * New closures now carry the value across. This recovers the ones already in
 * the database, in the same order of preference:
 *
 *   1. the lead's closureDetails.closure.finalDealValue
 *   2. the linked quotation's total
 *   3. the lead's quoteValue
 *
 * Where terms were captured too, it fills in the payment terms and derives a
 * due date, so existing orders join the overdue tracking rather than sitting
 * outside it forever.
 *
 * Never touches an order that already has a value, or one with payments
 * recorded against it — a ₹0 order carrying money is a different problem and
 * must not be papered over by a guess. Safe to re-run.
 *
 *   node scripts/backfill-order-values.js          # report only
 *   node scripts/backfill-order-values.js --apply  # write changes
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const fmt = (n) => '₹' + Number(n).toLocaleString('en-IN');

/** Mirrors lib/money.ts parseMoneyInput — "1,25,000" must not truncate to 1. */
function parseMoney(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (typeof value !== 'string') return NaN;
  const cleaned = value.replace(/[,\s]/g, '');
  if (cleaned === '') return NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

/** Mirrors lib/paymentTerms.ts — kept in step by the tests over there. */
function parseTermsDays(terms) {
  if (!terms) return null;
  const text = String(terms).trim().toLowerCase();
  if (!text) return null;
  if (/\d\s*%/.test(text) && /\b(balance|remaining|rest|then|and)\b/.test(text)) return null;
  if (/\b(immediate|immediately|advance|prepaid|pre-paid|cod|cash on delivery|on delivery|against delivery)\b/.test(text)) return 0;
  const net = text.match(/\bnet[\s-]*(\d{1,3})\b/);
  if (net) return within(Number(net[1]));
  const days = text.match(/\b(\d{1,3})\s*(?:days?|d)\b/);
  if (days) return within(Number(days[1]));
  return null;
}
const within = (n) => (Number.isFinite(n) && n >= 0 && n <= 365 ? n : null);

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(18, 29, 59, 999); // 23:59:59.999 IST
  return d;
}

/**
 * Find the lead behind an order. Order has no leadId, so this walks the same
 * chain the order detail page does: the linked deal, then the customer.
 */
async function findLead(order) {
  if (order.dealId) {
    const deal = await prisma.deal.findUnique({
      where: { id: order.dealId },
      select: { leadId: true },
    });
    if (deal?.leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: deal.leadId },
        select: { id: true, leadNumber: true, quoteValue: true, closureDetails: true },
      });
      if (lead) return lead;
    }
  }
  if (order.customerId) {
    return prisma.lead.findFirst({
      where: { linkedCustomerId: order.customerId, deletedAt: null },
      orderBy: { closedAt: 'desc' },
      select: { id: true, leadNumber: true, quoteValue: true, closureDetails: true },
    });
  }
  return null;
}

(async () => {
  const zeroOrders = await prisma.order.findMany({
    where: { totalAmount: 0 },
    select: {
      id: true, orderNumber: true, customerId: true, dealId: true, quotationId: true,
      poDate: true, createdAt: true, paymentTerms: true, paymentDueDate: true,
      quotation: { select: { totalAmount: true } },
      customer: { select: { companyName: true } },
      _count: { select: { payments: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\n  ${zeroOrders.length} order(s) with no value\n  ${'─'.repeat(60)}`);

  let fixed = 0;
  let skipped = 0;

  for (const order of zeroOrders) {
    if (order._count.payments > 0) {
      console.log(`  skip  ${order.orderNumber} — has ${order._count.payments} payment(s) recorded; needs a human`);
      skipped++;
      continue;
    }

    const lead = await findLead(order);
    const closure = (lead?.closureDetails && lead.closureDetails.closure) || {};

    const finalDealValue = parseMoney(closure.finalDealValue);
    const quoteTotal = order.quotation ? Number(order.quotation.totalAmount) : 0;
    const leadValue = lead?.quoteValue ? Number(lead.quoteValue) : 0;

    let value = null;
    let source = null;
    if (Number.isFinite(finalDealValue) && finalDealValue > 0) {
      value = finalDealValue; source = 'closure finalDealValue';
    } else if (quoteTotal > 0) {
      value = quoteTotal; source = 'linked quotation';
    } else if (leadValue > 0) {
      value = leadValue; source = 'lead.quoteValue';
    }

    if (value === null) {
      console.log(`  skip  ${order.orderNumber} — ${order.customer?.companyName ?? '?'}: no value recoverable anywhere`);
      skipped++;
      continue;
    }

    const terms = order.paymentTerms || (closure.paymentTermsFinal || '').trim() || null;
    const days = parseTermsDays(terms);
    const anchor = order.poDate || order.createdAt;
    const dueDate = order.paymentDueDate || (days !== null ? addDays(anchor, days) : null);

    console.log(
      `  fix   ${order.orderNumber} — ${order.customer?.companyName ?? '?'}: ${fmt(value)} (from ${source})` +
      (terms ? ` · terms "${terms}"` : '') +
      (dueDate && !order.paymentDueDate ? ` · due ${dueDate.toISOString().slice(0, 10)}` : '')
    );

    if (APPLY) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          totalAmount: value.toString(),
          ...(terms && !order.paymentTerms ? { paymentTerms: terms } : {}),
          ...(dueDate && !order.paymentDueDate ? { paymentDueDate: dueDate } : {}),
        },
      });
    }
    fixed++;
  }

  console.log(`  ${'─'.repeat(60)}`);
  console.log(`  ${fixed} repairable, ${skipped} left alone`);
  console.log(APPLY ? '  APPLIED\n' : '  DRY RUN — re-run with --apply to write\n');

  await prisma.$disconnect();
})().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
