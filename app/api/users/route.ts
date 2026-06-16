import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { ForbiddenError } from '@/lib/errors';
import bcrypt from 'bcryptjs';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  // Only admins and support can list users
  if (!['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'SALES_MANAGER'].includes(user.role)) {
    throw new ForbiddenError();
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const role = searchParams.get('role');
  const search = searchParams.get('search');
  // status=ex returns soft-deleted (ex-employee) users; default returns active records only.
  const status = searchParams.get('status');
  // active=true restricts to currently-active users (for assignment pickers).
  const activeOnly = searchParams.get('active') === 'true';

  const where: any = status === 'ex' ? { deletedAt: { not: null } } : { deletedAt: null };

  if (activeOnly) where.isActive = true;

  // Managers only see their team
  if (user.role === 'SALES_MANAGER') {
    where.managerId = user.id;
  }

  if (role) where.role = role;
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, department: true, isActive: true, createdAt: true,
        phone: true, employeeId: true, jobTitle: true, assignedTerritory: true,
        deletedAt: true,
        managerId: true,
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    users,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
    throw new ForbiddenError('Only admins can create users');
  }

  const {
    email, firstName, lastName, role, department, password, managerId,
    phone, employeeId, jobTitle, assignedTerritory,
  } = await req.json();

  if (!email || !firstName || !role || !password) {
    return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ message: 'A user with this email already exists' }, { status: 400 });
  }
  if (employeeId) {
    const idClash = await prisma.user.findUnique({ where: { employeeId } });
    if (idClash) {
      return NextResponse.json({ message: 'A user with this Employee ID already exists' }, { status: 400 });
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const newUser = await prisma.user.create({
    data: {
      email, firstName,
      lastName: lastName || '',
      role, passwordHash,
      department: department || null,
      phone: phone || null,
      employeeId: employeeId || null,
      jobTitle: jobTitle || null,
      assignedTerritory: assignedTerritory || null,
      ...(managerId && { managerId }),
    },
    select: {
      id: true, email: true, firstName: true, lastName: true, role: true, department: true,
    },
  });

  return NextResponse.json(newUser, { status: 201 });
});
