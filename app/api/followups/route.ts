import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const dealId = searchParams.get('dealId');
  const type = searchParams.get('type');
  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');
  const search = searchParams.get('search')?.trim();
  const status = searchParams.get('status'); // 'pending' | 'completed' | 'overdue'

  const where: any = {};
  const andConditions: any[] = [];

  // Role-based scoping
  if (user.role === 'ON_FIELD_TEAM') {
    where.createdById = user.id;
  } else if (user.role === 'BACKEND_TEAM') {
    const teamMembers = await prisma.user.findMany({
      where: { managerId: user.id },
      select: { id: true },
    });
    const teamIds = [user.id, ...teamMembers.map((u) => u.id)];
    where.createdById = { in: teamIds };
  }

  if (dealId) where.dealId = dealId;
  if (type) where.type = type;
  if (fromDate || toDate) {
    where.scheduledDate = {
      ...(fromDate && { gte: new Date(fromDate) }),
      ...(toDate && { lte: new Date(toDate + 'T23:59:59') }),
    };
  }
  if (status === 'completed') where.actualDate = { not: null };
  if (status === 'pending') { where.actualDate = null; }
  if (status === 'overdue') {
    where.actualDate = null;
    andConditions.push({ scheduledDate: { lt: new Date() } });
  }
  if (search) {
    andConditions.push({
      OR: [
        { deal: { customer: { companyName: { contains: search, mode: 'insensitive' } } } },
        { lead: { name: { contains: search, mode: 'insensitive' } } },
        { lead: { company: { contains: search, mode: 'insensitive' } } },
        { notes: { contains: search, mode: 'insensitive' } },
      ],
    });
  }
  if (andConditions.length > 0) where.AND = andConditions;

  const [followUps, total] = await Promise.all([
    prisma.followUp.findMany({
      where,
      include: {
        deal: { select: { id: true, dealName: true, customer: { select: { companyName: true } } } },
        lead: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { scheduledDate: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.followUp.count({ where }),
  ]);

  return NextResponse.json({
    followUps,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { dealId, leadId, type, scheduledDate, notes, relatedTaskId } = await req.json();

  if (!type || !scheduledDate) {
    return NextResponse.json({ message: 'type and scheduledDate are required' }, { status: 400 });
  }

  const followUp = await prisma.followUp.create({
    data: {
      dealId: dealId || null,
      leadId: leadId || null,
      type,
      scheduledDate: new Date(scheduledDate),
      notes: notes || null,
      createdById: user.id,
    },
    include: {
      deal: { select: { id: true, dealName: true, customer: { select: { companyName: true } } } },
      lead: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (relatedTaskId) {
    await prisma.task.update({
      where: { id: relatedTaskId },
      data: { relatedFollowUpId: followUp.id },
    });
  }

  return NextResponse.json(followUp, { status: 201 });
});
