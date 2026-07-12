import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { isAdmin, canManageUser, roleRank } from '@/lib/roles';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

async function verifyAuth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) throw new Error('Unauthorized');

  try {
    return jwt.verify(token, JWT_SECRET) as { id: string; role: string };
  } catch {
    throw new Error('Invalid token');
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await verifyAuth(req);

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
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await verifyAuth(req);
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
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await verifyAuth(req);

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

    // Business records have required FKs and would orphan data; they must be
    // reassigned before deletion. Personal logs (dailyActivity, activityLog,
    // timeLog, notifications, …) cascade automatically on user.delete().
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
      await prisma.user.delete({ where: { id } });
      return NextResponse.json({ message: 'User permanently deleted', deleted: 'hard' });
    }

    // Default delete: hard-delete if no business records, otherwise mark as ex-employee.
    if (businessCount === 0) {
      await prisma.user.delete({ where: { id } });
      return NextResponse.json({ message: 'User permanently deleted', deleted: 'hard' });
    }

    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return NextResponse.json({
      message: 'User marked as ex-employee (records preserved)',
      deleted: 'soft',
      recordCount: businessCount,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
