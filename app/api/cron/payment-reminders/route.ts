import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createNotification, notifyAdminsAndManagers } from '@/lib/notify';
import { checkCronAuth } from '@/lib/cronAuth';
import { istToday, istDateString } from '@/lib/istDate';
import { daysOverdue } from '@/lib/paymentTerms';

/**
 * Daily receivables sweep.
 *
 * Nothing in the CRM watched what was owed. At the time this was written the
 * database held 80 unpaid orders carrying ₹11.16 cr, 78 of them more than
 * thirty days old, and no screen anywhere distinguished those from an order
 * raised that morning — because until now there was no due date to compare
 * against. Chasing payment was entirely someone's memory.
 *
 * Notifies in-app only. Outbound mail is limited to password reset and account
 * recovery (see the policy at the top of lib/mail.ts).
 *
 * Called by an external scheduler:
 *   curl -X POST -H "x-cron-secret: $CRON_SECRET" $APP_URL/api/cron/payment-reminders
 */

/** Notice this many days ahead, so a payment can be chased before it is late. */
const DUE_SOON_DAYS = 3;

/**
 * How often an already-overdue order is raised again.
 *
 * Daily would be correct and useless: an order ninety days late would generate
 * ninety notifications, and the reliable outcome of that is a person who stops
 * reading them. Weekly keeps it present without training the team to dismiss.
 */
const OVERDUE_REPEAT_DAYS = 7;

function fmtINR(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export async function POST(req: NextRequest) {
  const denied = checkCronAuth(req, 'payment-reminders');
  if (denied) return denied;

  const today = istToday();

  // Only orders that actually owe money and have a date to be measured
  // against. paymentStatus is maintained from the ledger on every payment
  // write, so it is a trustworthy — and indexed — stand-in for "still owed".
  const candidates = await prisma.order.findMany({
    where: {
      paymentStatus: { in: ['PENDING', 'PARTIAL'] },
      paymentDueDate: { not: null },
    },
    select: {
      id: true,
      orderNumber: true,
      totalAmount: true,
      amountPaid: true,
      paymentDueDate: true,
      customer: { select: { companyName: true } },
      deal: { select: { assignedToId: true } },
    },
  });

  const due: { order: typeof candidates[number]; balance: number; overdueBy: number; dueIn: number }[] = [];

  for (const order of candidates) {
    const balance = Number(order.totalAmount) - Number(order.amountPaid);
    // A ₹0 balance on a PENDING/PARTIAL order means the cached status is
    // behind the ledger. Skip rather than chase money that is already in.
    if (!(balance > 0.001)) continue;

    const overdueBy = daysOverdue(order.paymentDueDate);
    const dueIn = overdueBy > 0
      ? -overdueBy
      : daysBetween(today, istDateString(order.paymentDueDate!));

    if (overdueBy > 0) {
      // Re-raise on the due date itself and then weekly, so a long-outstanding
      // order stays visible without arriving every single morning.
      if (overdueBy % OVERDUE_REPEAT_DAYS !== 0) continue;
    } else if (dueIn > DUE_SOON_DAYS) {
      continue;
    }

    due.push({ order, balance, overdueBy, dueIn });
  }

  if (due.length === 0) {
    return NextResponse.json({ checked: candidates.length, notified: 0, orders: [] });
  }

  // Skip anything already raised today. Without this a scheduler that fires
  // twice — a retry, a manual run, two hosts sharing a crontab — would notify
  // the same people about the same order again.
  const alreadyToday = await prisma.notification.findMany({
    where: {
      type: 'PAYMENT_DUE',
      relatedEntityType: 'ORDER',
      relatedEntityId: { in: due.map((d) => d.order.id) },
      createdAt: { gte: new Date(`${today}T00:00:00.000+05:30`) },
    },
    select: { relatedEntityId: true },
  });
  const seen = new Set(alreadyToday.map((n) => n.relatedEntityId));

  const notified: string[] = [];
  let overdueCount = 0;
  let overdueValue = 0;

  for (const { order, balance, overdueBy, dueIn } of due) {
    if (seen.has(order.id)) continue;

    const company = order.customer?.companyName ?? 'this customer';
    const when =
      overdueBy > 0 ? `${overdueBy} day${overdueBy === 1 ? '' : 's'} overdue`
      : dueIn === 0 ? 'due today'
      : `due in ${dueIn} day${dueIn === 1 ? '' : 's'}`;

    const title = overdueBy > 0 ? 'Payment overdue' : 'Payment due soon';
    const message = `${order.orderNumber} — ${company}: ${fmtINR(balance)} outstanding, ${when}.`;

    // The person who owns the deal is the one who can actually chase it.
    if (order.deal?.assignedToId) {
      await createNotification(
        order.deal.assignedToId,
        'PAYMENT_DUE',
        title,
        message,
        'ORDER',
        order.id,
      );
    }

    notified.push(order.orderNumber);
    if (overdueBy > 0) {
      overdueCount++;
      overdueValue += balance;
    }
  }

  // One digest for admins and managers rather than a notification per order —
  // they are looking at the book, not chasing individual invoices.
  if (overdueCount > 0) {
    await notifyAdminsAndManagers(
      'PAYMENT_DUE',
      'Overdue payments',
      `${overdueCount} order${overdueCount === 1 ? '' : 's'} past the payment due date, ${fmtINR(overdueValue)} outstanding in total.`,
      'ORDER',
      undefined,
    );
  }

  return NextResponse.json({
    checked: candidates.length,
    notified: notified.length,
    overdue: overdueCount,
    overdueValue,
    orders: notified,
  });
}

/** Whole days from one `YYYY-MM-DD` to another. */
function daysBetween(from: string, to: string): number {
  const parse = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parse(to) - parse(from)) / 86400000);
}
