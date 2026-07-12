import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { isAdmin, canManageUser, roleRank } from '@/lib/roles';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function verifyAuth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) throw new Error('Unauthorized');
  return jwt.verify(token, JWT_SECRET) as { id: string; role: string };
}

/**
 * POST /api/users/[id]/role-switch
 *
 * Atomically switches a user's role and handles redistribution of their leads,
 * deals, tasks, and subordinates — all in a single Prisma transaction.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = verifyAuth(req);

    if (!isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Only admins can switch user roles' }, { status: 403 });
    }
    if (auth.id === id) {
      return NextResponse.json({ error: 'You cannot switch your own role' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, firstName: true, lastName: true, deletedAt: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (targetUser.deletedAt) {
      return NextResponse.json({ error: 'Cannot switch role of an ex-employee' }, { status: 400 });
    }
    if (!canManageUser(auth.role, targetUser.role)) {
      return NextResponse.json(
        { error: 'You do not have permission to switch the role of this user.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      newRole,
      leadsAction = 'keep',
      leadsTargetUserId,
      broughtLeadsAction = 'keep',
      broughtLeadsTargetUserId,
      dealsAction = 'keep',
      dealsTargetUserId,
      tasksAction = 'keep',
      tasksTargetUserId,
      subordinateReassignments = [],
    } = body;

    // Validate new role
    if (!newRole || !['BACKEND_TEAM', 'ON_FIELD_TEAM'].includes(newRole)) {
      return NextResponse.json({ error: 'newRole must be BACKEND_TEAM or ON_FIELD_TEAM' }, { status: 400 });
    }
    if (newRole === targetUser.role) {
      return NextResponse.json({ error: 'User is already in that role' }, { status: 400 });
    }
    if (roleRank(newRole) >= roleRank(auth.role)) {
      return NextResponse.json(
        { error: 'You cannot assign a role equal to or above your own.' },
        { status: 403 }
      );
    }

    // When demoting to ON_FIELD_TEAM, subordinates must be handled
    const isDemotion = newRole === 'ON_FIELD_TEAM';
    if (isDemotion) {
      const subordinateCount = await prisma.user.count({ where: { managerId: id } });
      if (subordinateCount > 0 && (!subordinateReassignments || subordinateReassignments.length === 0)) {
        return NextResponse.json(
          { error: `This user has ${subordinateCount} team member(s) reporting to them. Provide subordinateReassignments to reassign them.` },
          { status: 400 }
        );
      }
    }

    // Validate all transfer targets exist and are active
    const transferTargetIds = [
      leadsAction === 'transfer' ? leadsTargetUserId : null,
      broughtLeadsAction === 'transfer' ? broughtLeadsTargetUserId : null,
      dealsAction === 'transfer' ? dealsTargetUserId : null,
      tasksAction === 'transfer' ? tasksTargetUserId : null,
      ...subordinateReassignments.map((r: any) => r.newManagerId),
    ].filter(Boolean) as string[];

    if (transferTargetIds.length > 0) {
      const uniqueTargetIds = [...new Set(transferTargetIds)];
      const activeTargets = await prisma.user.findMany({
        where: { id: { in: uniqueTargetIds }, deletedAt: null, isActive: true },
        select: { id: true },
      });
      const foundIds = new Set(activeTargets.map((u: any) => u.id));
      const missing = uniqueTargetIds.filter(tid => !foundIds.has(tid));
      if (missing.length > 0) {
        return NextResponse.json(
          { error: 'One or more transfer target users are inactive or not found.' },
          { status: 400 }
        );
      }
    }

    // Execute everything in a single transaction
    const result = await prisma.$transaction(async (tx) => {
      let leadsTransferred = 0;
      let broughtLeadsTransferred = 0;
      let dealsTransferred = 0;
      let tasksTransferred = 0;
      let subordinatesReassigned = 0;

      if (leadsAction === 'transfer' && leadsTargetUserId) {
        const r = await tx.lead.updateMany({ where: { assignedToId: id }, data: { assignedToId: leadsTargetUserId } });
        leadsTransferred = r.count;
      }

      if (broughtLeadsAction === 'transfer' && broughtLeadsTargetUserId) {
        const r = await tx.lead.updateMany({ where: { broughtById: id }, data: { broughtById: broughtLeadsTargetUserId } });
        broughtLeadsTransferred = r.count;
      }

      if (dealsAction === 'transfer' && dealsTargetUserId) {
        const r = await tx.deal.updateMany({ where: { assignedToId: id }, data: { assignedToId: dealsTargetUserId } });
        dealsTransferred = r.count;
      }

      if (tasksAction === 'transfer' && tasksTargetUserId) {
        const r = await tx.task.updateMany({ where: { assignedToId: id }, data: { assignedToId: tasksTargetUserId } });
        tasksTransferred = r.count;
      }

      for (const assignment of subordinateReassignments) {
        await tx.user.update({
          where: { id: assignment.subordinateId },
          data: { managerId: assignment.newManagerId || null },
        });
        subordinatesReassigned++;
      }

      // Clear any remaining subordinates if demoting (safety net)
      if (isDemotion) {
        await tx.user.updateMany({ where: { managerId: id }, data: { managerId: null } });
      }

      const updateData: any = { role: newRole };
      if (!isDemotion) {
        updateData.managerId = null; // Promoted to Backend: clear their own manager
      }

      const updatedUser = await tx.user.update({
        where: { id },
        data: updateData,
        select: { id: true, firstName: true, lastName: true, role: true },
      });

      await tx.activityLog.create({
        data: {
          userId: auth.id,
          action: 'UPDATE',
          entityType: 'USER',
          entityId: id,
          changes: {
            roleSwitch: {
              from: targetUser.role,
              to: newRole,
              leadsTransferred,
              broughtLeadsTransferred,
              dealsTransferred,
              tasksTransferred,
              subordinatesReassigned,
            },
          },
        },
      });

      return { user: updatedUser, leadsTransferred, broughtLeadsTransferred, dealsTransferred, tasksTransferred, subordinatesReassigned };
    });

    return NextResponse.json({
      message: `${result.user.firstName} ${result.user.lastName} has been switched to ${newRole === 'BACKEND_TEAM' ? 'Backend Team' : 'On Field Team'}.`,
      ...result,
    });
  } catch (err: any) {
    console.error('[role-switch]', err);
    return NextResponse.json({ error: err.message || 'Failed to switch role' }, { status: 500 });
  }
}
