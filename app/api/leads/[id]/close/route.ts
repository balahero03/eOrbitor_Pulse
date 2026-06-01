import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import { sendMail, buildWonEmail, buildLostEmail } from '@/lib/mail';

// POST /api/leads/[id]/close
// Body: { outcome: 'WON' | 'LOST' | 'DROPPED', reason?: string }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withAuth(async (req: NextRequest, user: AuthUser) => {
    const { outcome, reason } = await req.json();

    if (!['WON', 'LOST', 'DROPPED'].includes(outcome)) {
      throw new ValidationError('outcome must be WON, LOST, or DROPPED');
    }

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        broughtBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!lead || lead.deletedAt) {
      return NextResponse.json({ message: 'Lead not found' }, { status: 404 });
    }

    // Only assigned user, manager, or admin can close
    const canClose =
      ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER'].includes(user.role) ||
      lead.assignedToId === user.id;
    if (!canClose) throw new ForbiddenError();

    // Must be at CLOSURE stage to close
    if (lead.status !== 'CLOSURE') {
      throw new ValidationError('Lead must be at CLOSURE stage before closing');
    }

    // Get manager(s) and admins to notify
    const [managers, admins] = await Promise.all([
      lead.assignedTo.id
        ? prisma.user.findMany({
            where: { id: { in: await getManagerIds(lead.assignedToId) } },
            select: { email: true, firstName: true, lastName: true },
          })
        : Promise.resolve([]),
      prisma.user.findMany({
        where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
        select: { email: true, firstName: true, lastName: true },
      }),
    ]);

    const notifyEmails = [
      ...managers.map(m => m.email),
      ...admins.map(a => a.email),
    ].filter(Boolean);

    const repName = `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}`;
    const managerName = managers[0] ? `${managers[0].firstName} ${managers[0].lastName}` : 'Manager';

    if (outcome === 'WON') {
      // 1. Update lead status to ORDER (moves out of pipeline)
      const updated = await prisma.lead.update({
        where: { id },
        data: {
          status: 'ORDER',
          closedAt: new Date(),
          closureReason: reason || null,
        } as any,
        include: {
          assignedTo: { select: { firstName: true, lastName: true } },
          linkedCustomer: { select: { id: true, companyName: true } },
        },
      });

      // 2. Send win email to manager + admins
      if (notifyEmails.length > 0) {
        await sendMail({
          to: notifyEmails,
          subject: `🏆 Lead WON — ${lead.company} (${lead.name})`,
          html: buildWonEmail(
            { name: lead.name, company: lead.company, quoteValue: lead.quoteValue },
            repName, managerName
          ),
        });
      }

      return NextResponse.json({ outcome: 'WON', lead: updated, message: 'Lead won! Moved to Orders.' });
    }

    // LOST or DROPPED
    const newStatus = outcome === 'LOST' ? 'LOST' : 'DROPPED';

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        status: newStatus,
        closedAt: new Date(),
        closureReason: reason || null,
      } as any,
      include: {
        assignedTo: { select: { firstName: true, lastName: true } },
      },
    });

    // Send lost/dropped email to manager + admins
    if (notifyEmails.length > 0) {
      await sendMail({
        to: notifyEmails,
        subject: `${outcome === 'LOST' ? '❌ Lead LOST' : '🚫 Lead DROPPED'} — ${lead.company}`,
        html: buildLostEmail(
          { name: lead.name, company: lead.company },
          outcome as 'LOST' | 'DROPPED',
          reason || '',
          repName
        ),
      });
    }

    return NextResponse.json({ outcome: newStatus, lead: updated, message: `Lead marked as ${newStatus}.` });
  })(req);
}

async function getManagerIds(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { managerId: true },
  });
  return user?.managerId ? [user.managerId] : [];
}
