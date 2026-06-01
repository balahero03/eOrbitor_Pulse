import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const status = searchParams.get('status');
  const priority = searchParams.get('priority');
  const search = searchParams.get('search');
  const customerId = searchParams.get('customerId');

  const where: any = {};

  // Role-based scoping
  if (user.role === 'SUPPORT') {
    where.assignedToId = user.id;
  } else if (user.role === 'SALES_EXEC') {
    where.createdById = user.id;
  } else if (user.role === 'SALES_MANAGER') {
    const subordinates = await prisma.user.findMany({
      where: { managerId: user.id },
      select: { id: true },
    });
    const teamIds = [user.id, ...subordinates.map((u) => u.id)];
    where.createdById = { in: teamIds };
  }
  // ADMIN/SUPER_ADMIN see all

  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (customerId) where.customerId = customerId;
  if (search) {
    where.OR = [
      { subject: { contains: search, mode: 'insensitive' } },
      { ticketNumber: { contains: search, mode: 'insensitive' } },
    ];
  }

  const skip = (page - 1) * limit;
  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: { customer: true, assignedTo: true, createdBy: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.ticket.count({ where }),
  ]);

  return NextResponse.json({
    tickets,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { customerId, dealId, type, priority, subject, description, assignedToId } = await req.json();

  if (!customerId || !type || !priority || !subject || !description) {
    return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
  }

  const resolvedAssignedTo =
    ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER'].includes(user.role) && assignedToId
      ? assignedToId
      : user.id;

  const ticketNumber = `TKT-${Date.now()}`;

  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber, customerId,
      dealId: dealId || null,
      type, priority, subject, description,
      assignedToId: resolvedAssignedTo,
      createdById: user.id,
    },
    include: { customer: true, assignedTo: true, createdBy: true },
  });

  return NextResponse.json(ticket, { status: 201 });
});
