import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/middleware/auth';

// POST /api/users/[id]/reassign  { targetUserId }
// Moves all business records owned by the ex-employee (id) to a current
// employee (targetUserId), in a single transaction. After this, the ex-employee
// owns no required-FK records and can be permanently removed.
export const POST = withAuth(async (req: NextRequest, auth, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;

    if (auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only the Super Admin can reassign ex-employee records' }, { status: 403 });
    }

    const { targetUserId } = await req.json();
    if (!targetUserId) {
      return NextResponse.json({ error: 'A target user is required' }, { status: 400 });
    }
    if (targetUserId === id) {
      return NextResponse.json({ error: 'Cannot reassign records to the same user' }, { status: 400 });
    }

    const target = await prisma.user.findFirst({
      where: { id: targetUserId, deletedAt: null, isActive: true },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!target) {
      return NextResponse.json({ error: 'Target must be an active user' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const leadsAssigned = await tx.lead.updateMany({ where: { assignedToId: id }, data: { assignedToId: targetUserId } });
      const leadsBrought = await tx.lead.updateMany({ where: { broughtById: id }, data: { broughtById: targetUserId } });
      const deals = await tx.deal.updateMany({ where: { assignedToId: id }, data: { assignedToId: targetUserId } });
      const quotations = await tx.quotation.updateMany({ where: { createdById: id }, data: { createdById: targetUserId } });
      const followUps = await tx.followUp.updateMany({ where: { createdById: id }, data: { createdById: targetUserId } });
      const tasksCreated = await tx.task.updateMany({ where: { createdById: id }, data: { createdById: targetUserId } });
      const tasksAssigned = await tx.task.updateMany({ where: { assignedToId: id }, data: { assignedToId: targetUserId } });
      const subordinates = await tx.user.updateMany({ where: { managerId: id }, data: { managerId: targetUserId } });

      return {
        leadsAssigned: leadsAssigned.count,
        leadsBrought: leadsBrought.count,
        deals: deals.count,
        quotations: quotations.count,
        followUps: followUps.count,
        tasksCreated: tasksCreated.count,
        tasksAssigned: tasksAssigned.count,
        subordinates: subordinates.count,
      };
    });

    const reassigned = Object.values(result).reduce((s, n) => s + n, 0);

    return NextResponse.json({
      message: `Reassigned ${reassigned} record(s) to ${target.firstName} ${target.lastName}`,
      reassigned,
      breakdown: result,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to reassign records' }, { status: 500 });
  }
});
