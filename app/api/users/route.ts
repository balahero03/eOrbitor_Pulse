import { NextRequest, NextResponse } from 'next/server';
import { sanitizeSearch, parseEnumParam } from '@/lib/queryFilters';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { parsePagination, paginationMeta } from '@/lib/pagination';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { ForbiddenError } from '@/lib/errors';
import { roleRank } from '@/lib/roles';
import bcrypt from 'bcryptjs';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  // Any authenticated user can list users (needed for assignment pickers)

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const role = parseEnumParam(searchParams.get('role'), UserRole, 'user role');
  const search = sanitizeSearch(searchParams.get('search'));
  // status=ex returns soft-deleted (ex-employee) users; default returns active records only.
  const status = searchParams.get('status');
  // active=true restricts to currently-active users (for assignment pickers).
  const activeOnly = searchParams.get('active') === 'true';

  const where: any = status === 'ex' ? { deletedAt: { not: null } } : { deletedAt: null };

  if (activeOnly) where.isActive = true;

  if (role) where.role = role;
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

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
    pagination: paginationMeta(page, limit, total),
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

  // Can't mint an account at or above your own seniority — e.g. an ADMIN may
  // not create a SUPER_ADMIN (or another ADMIN). Only a SUPER_ADMIN can.
  if (roleRank(role) >= roleRank(user.role)) {
    return NextResponse.json(
      { message: 'You cannot create a user with a role equal to or above your own.' },
      { status: 403 }
    );
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
