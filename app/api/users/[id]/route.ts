import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

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
    await verifyAuth(req);
    const body = await req.json();

    const {
      firstName, lastName, role, department, assignedTerritory, isActive, managerId, password,
      phone, employeeId, jobTitle, restore,
    } = body;

    const updateData: any = {};

    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (role) updateData.role = role;
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

    if (!['SUPER_ADMIN', 'ADMIN'].includes(auth.role)) {
      return NextResponse.json({ error: 'Only admins can delete users' }, { status: 403 });
    }
    if (auth.id === id) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, deletedAt: true } });
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const hard = searchParams.get('hard') === 'true';

    // Count every record this user owns/created. If any exist, the row cannot
    // be hard-deleted without orphaning data.
    const [
      leads, broughtLeads, deals, quotations, followUps,
      tasks, assignedTasks, dailyActivities, activityLogs, timeLogs, subordinates,
    ] = await Promise.all([
      prisma.lead.count({ where: { assignedToId: id } }),
      prisma.lead.count({ where: { broughtById: id } }),
      prisma.deal.count({ where: { assignedToId: id } }),
      prisma.quotation.count({ where: { createdById: id } }),
      prisma.followUp.count({ where: { createdById: id } }),
      prisma.task.count({ where: { createdById: id } }),
      prisma.task.count({ where: { assignedToId: id } }),
      prisma.dailyActivity.count({ where: { userId: id } }),
      prisma.activityLog.count({ where: { userId: id } }),
      prisma.timeLog.count({ where: { userId: id } }),
      prisma.user.count({ where: { managerId: id } }),
    ]);

    const recordCount =
      leads + broughtLeads + deals + quotations + followUps +
      tasks + assignedTasks + dailyActivities + activityLogs + timeLogs + subordinates;

    // Hard-delete: only when explicitly requested AND the user owns nothing.
    if (hard) {
      if (recordCount > 0) {
        return NextResponse.json(
          { error: `Cannot permanently delete — user still owns ${recordCount} record(s). Reassign them first.` },
          { status: 409 }
        );
      }
      await prisma.user.delete({ where: { id } });
      return NextResponse.json({ message: 'User permanently deleted', deleted: 'hard' });
    }

    // Default delete: hard-delete if no records, otherwise mark as ex-employee.
    if (recordCount === 0) {
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
      recordCount,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
