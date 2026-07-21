import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { withAuth } from '@/lib/middleware/auth';
import { isAdmin, canManageUser, roleRank } from '@/lib/roles';

export const GET = withAuth(async (_req: NextRequest, _user, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id: id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        department: true,
        assignedTerritory: true,
        phone: true,
        employeeId: true,
        jobTitle: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
});

export const PATCH = withAuth(async (req: NextRequest, auth, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const body = await req.json();

    const {
      firstName, lastName, role, department, assignedTerritory, isActive, managerId, password,
      phone, employeeId, jobTitle, restore,
    } = body;

    // Only admins may edit accounts.
    if (!isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Only admins can edit users' }, { status: 403 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isSelf = auth.id === id;
    // You may only edit a user ranked strictly below you — editing yourself is
    // allowed for profile fields, but never your own role (guarded below).
    // This stops an ADMIN from deactivating, resetting, or demoting a
    // SUPER_ADMIN (or another ADMIN), which would otherwise sidestep the
    // delete-hierarchy rule.
    if (!isSelf && !canManageUser(auth.role, targetUser.role)) {
      return NextResponse.json(
        { error: 'You do not have permission to edit a user of this role.' },
        { status: 403 }
      );
    }
    // A role change can never grant a rank at or above the actor's own, and
    // nobody may change their own role (no self-promotion or self-demotion).
    if (role !== undefined && role !== targetUser.role) {
      if (isSelf) {
        return NextResponse.json({ error: 'You cannot change your own role.' }, { status: 403 });
      }
      if (roleRank(role) >= roleRank(auth.role)) {
        return NextResponse.json({ error: 'You cannot assign a role equal to or above your own.' }, { status: 403 });
      }
    }

    const updateData: any = {};

    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (role) {
      updateData.role = role;
      if (role === 'ON_FIELD_TEAM' && targetUser.role !== 'ON_FIELD_TEAM') {
        // Clear managerId for subordinates as On Field Team members cannot manage others.
        await prisma.user.updateMany({
          where: { managerId: id },
          data: { managerId: null },
        });
      }
    }
    if (department !== undefined) updateData.department = department;
    if (assignedTerritory !== undefined) updateData.assignedTerritory = assignedTerritory || null;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (managerId !== undefined) updateData.managerId = managerId || null;
    if (phone !== undefined) updateData.phone = phone || null;
    if (jobTitle !== undefined) updateData.jobTitle = jobTitle || null;
    if (employeeId !== undefined) {
      // Enforce employeeId uniqueness across other users.
      if (employeeId) {
        const clash = await prisma.user.findFirst({
          where: { employeeId, NOT: { id } },
          select: { id: true },
        });
        if (clash) {
          return NextResponse.json({ error: 'A user with this Employee ID already exists' }, { status: 400 });
        }
      }
      updateData.employeeId = employeeId || null;
    }
    // Restore an ex-employee: clear deletedAt and reactivate.
    if (restore) {
      updateData.deletedAt = null;
      updateData.isActive = true;
    }
    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
      }
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id: id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        department: true,
        isActive: true,
      },
    });

    return NextResponse.json(user);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req: NextRequest, auth, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;

    if (!isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Only admins can delete users' }, { status: 403 });
    }
    if (auth.id === id) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, deletedAt: true } });
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Enforce seniority: you can only delete a user ranked strictly below you.
    // This makes a SUPER_ADMIN undeletable by an ADMIN (or by another
    // SUPER_ADMIN), and stops ADMINs from deleting each other.
    if (!canManageUser(auth.role, target.role)) {
      return NextResponse.json(
        { error: 'You do not have permission to delete a user of this role.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const hard = searchParams.get('hard') === 'true';

    // Optional reassignment instructions from the delete-preview flow — lets an
    // admin hand business records off to a replacement in the same step instead
    // of reassigning later via the ex-employee records panel. Mirrors the
    // keep/transfer pattern used by /role-switch.
    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }
    const {
      leadsAction = 'keep', leadsTargetUserId,
      broughtLeadsAction = 'keep', broughtLeadsTargetUserId,
      dealsAction = 'keep', dealsTargetUserId,
      quotationsAction = 'keep', quotationsTargetUserId,
      followUpsAction = 'keep', followUpsTargetUserId,
      tasksCreatedAction = 'keep', tasksCreatedTargetUserId,
      tasksAssignedAction = 'keep', tasksAssignedTargetUserId,
      subordinatesAction = 'keep', subordinatesTargetUserId,
    } = body;

    const transferTargetIds = [
      leadsAction === 'transfer' ? leadsTargetUserId : null,
      broughtLeadsAction === 'transfer' ? broughtLeadsTargetUserId : null,
      dealsAction === 'transfer' ? dealsTargetUserId : null,
      quotationsAction === 'transfer' ? quotationsTargetUserId : null,
      followUpsAction === 'transfer' ? followUpsTargetUserId : null,
      tasksCreatedAction === 'transfer' ? tasksCreatedTargetUserId : null,
      tasksAssignedAction === 'transfer' ? tasksAssignedTargetUserId : null,
      subordinatesAction === 'transfer' ? subordinatesTargetUserId : null,
    ].filter(Boolean) as string[];

    if (transferTargetIds.length > 0) {
      const uniqueTargetIds = [...new Set(transferTargetIds)];
      if (uniqueTargetIds.includes(id)) {
        return NextResponse.json({ error: 'Cannot reassign records to the user being deleted' }, { status: 400 });
      }
      const activeTargets = await prisma.user.findMany({
        where: { id: { in: uniqueTargetIds }, deletedAt: null, isActive: true },
        select: { id: true },
      });
      const foundIds = new Set(activeTargets.map((u: any) => u.id));
      const missing = uniqueTargetIds.filter(tid => !foundIds.has(tid));
      if (missing.length > 0) {
        return NextResponse.json({ error: 'One or more transfer target users are inactive or not found.' }, { status: 400 });
      }
    }

    // Run any requested transfers atomically before deciding hard vs. soft delete.
    const transferred: Record<string, number> = await prisma.$transaction(async (tx) => {
      const out: Record<string, number> = {};
      if (leadsAction === 'transfer' && leadsTargetUserId) {
        out.leadsAssigned = (await tx.lead.updateMany({ where: { assignedToId: id }, data: { assignedToId: leadsTargetUserId } })).count;
      }
      if (broughtLeadsAction === 'transfer' && broughtLeadsTargetUserId) {
        out.leadsBrought = (await tx.lead.updateMany({ where: { broughtById: id }, data: { broughtById: broughtLeadsTargetUserId } })).count;
      }
      if (dealsAction === 'transfer' && dealsTargetUserId) {
        out.deals = (await tx.deal.updateMany({ where: { assignedToId: id }, data: { assignedToId: dealsTargetUserId } })).count;
      }
      if (quotationsAction === 'transfer' && quotationsTargetUserId) {
        out.quotations = (await tx.quotation.updateMany({ where: { createdById: id }, data: { createdById: quotationsTargetUserId } })).count;
      }
      if (followUpsAction === 'transfer' && followUpsTargetUserId) {
        out.followUps = (await tx.followUp.updateMany({ where: { createdById: id }, data: { createdById: followUpsTargetUserId } })).count;
      }
      if (tasksCreatedAction === 'transfer' && tasksCreatedTargetUserId) {
        out.tasksCreated = (await tx.task.updateMany({ where: { createdById: id }, data: { createdById: tasksCreatedTargetUserId } })).count;
      }
      if (tasksAssignedAction === 'transfer' && tasksAssignedTargetUserId) {
        out.tasksAssigned = (await tx.task.updateMany({ where: { assignedToId: id }, data: { assignedToId: tasksAssignedTargetUserId } })).count;
      }
      if (subordinatesAction === 'transfer' && subordinatesTargetUserId) {
        out.subordinates = (await tx.user.updateMany({ where: { managerId: id }, data: { managerId: subordinatesTargetUserId } })).count;
      }
      return out;
    });

    // Business records have required FKs and would orphan data; whatever wasn't
    // just transferred must be reassigned before hard deletion. Personal logs
    // (dailyActivity, activityLog, timeLog, notifications, …) cascade
    // automatically on user.delete().
    const [
      leads, broughtLeads, deals, quotations, followUps,
      tasks, assignedTasks, subordinates,
    ] = await Promise.all([
      prisma.lead.count({ where: { assignedToId: id } }),
      prisma.lead.count({ where: { broughtById: id } }),
      prisma.deal.count({ where: { assignedToId: id } }),
      prisma.quotation.count({ where: { createdById: id } }),
      prisma.followUp.count({ where: { createdById: id } }),
      prisma.task.count({ where: { createdById: id } }),
      prisma.task.count({ where: { assignedToId: id } }),
      prisma.user.count({ where: { managerId: id } }),
    ]);

    const businessCount =
      leads + broughtLeads + deals + quotations + followUps +
      tasks + assignedTasks + subordinates;

    const logDelete = (deleteType: 'hard' | 'soft') => prisma.activityLog.create({
      data: {
        userId: auth.id,
        action: 'DELETE',
        entityType: 'USER',
        entityId: id,
        changes: { deleteType, transferred, remainingRecordCount: businessCount },
      },
    });

    // Hard-delete (permanent): Super Admin only, and only once all business
    // records have been reassigned. Personal logs cascade away with the user.
    if (hard) {
      if (auth.role !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Only the Super Admin can permanently remove a user' }, { status: 403 });
      }
      if (businessCount > 0) {
        return NextResponse.json(
          { error: `Cannot permanently delete — user still owns ${businessCount} business record(s). Reassign them first.` },
          { status: 409 }
        );
      }
      await logDelete('hard');
      await prisma.user.delete({ where: { id } });
      return NextResponse.json({ message: 'User permanently deleted', deleted: 'hard', transferred });
    }

    // Default delete: hard-delete if no business records remain, otherwise mark as ex-employee.
    if (businessCount === 0) {
      await logDelete('hard');
      await prisma.user.delete({ where: { id } });
      return NextResponse.json({ message: 'User permanently deleted', deleted: 'hard', transferred });
    }

    await logDelete('soft');
    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return NextResponse.json({
      message: Object.keys(transferred).length > 0
        ? `User marked as ex-employee — ${businessCount} record(s) remain (some were reassigned).`
        : 'User marked as ex-employee (records preserved)',
      deleted: 'soft',
      recordCount: businessCount,
      transferred,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
});
