import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const status = searchParams.get('status');
  const source = searchParams.get('source');
  const search = searchParams.get('search');
  const assignedToId = searchParams.get('assignedToId');
  const rfqFrom = searchParams.get('rfqFrom');
  const rfqTo = searchParams.get('rfqTo');
  const followUpFrom = searchParams.get('followUpFrom');
  const followUpTo = searchParams.get('followUpTo');
  const hasFollowUp = searchParams.get('hasFollowUp');
  const quoteValueMin = searchParams.get('quoteValueMin');
  const quoteValueMax = searchParams.get('quoteValueMax');

  // Active leads only — closed leads live in /api/leads/closed
  const CLOSED_STATUSES = ['WON', 'LOST', 'DROPPED', 'ORDER'];
  const where: any = {
    deletedAt: null,
    status: { notIn: CLOSED_STATUSES },
  };
  const andConditions: any[] = [];

  // Role-based data scoping
  if (user.role === 'SALES_EXEC') {
    where.assignedToId = user.id;
  } else if (user.role === 'SALES_MANAGER') {
    const teamMembers = await prisma.user.findMany({
      where: { managerId: user.id },
      select: { id: true },
    });
    const teamIds = [user.id, ...teamMembers.map((u) => u.id)];
    where.assignedToId = { in: teamIds };
  }
  // ADMIN/SUPER_ADMIN see all — no extra filter

  if (status && !CLOSED_STATUSES.includes(status)) where.status = status;
  if (source) where.source = source;
  // Only allow assignedToId filter override for managers/admins
  if (assignedToId && ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER'].includes(user.role)) {
    where.assignedToId = assignedToId;
  }

  if (rfqFrom || rfqTo) {
    where.rfqDate = {
      ...(rfqFrom && { gte: new Date(rfqFrom) }),
      ...(rfqTo && { lte: new Date(rfqTo + 'T23:59:59') }),
    };
  }
  if (followUpFrom || followUpTo) {
    where.followUpDate = {
      ...(followUpFrom && { gte: new Date(followUpFrom) }),
      ...(followUpTo && { lte: new Date(followUpTo + 'T23:59:59') }),
    };
  }
  if (hasFollowUp === 'yes') where.followUpDate = { not: null };
  if (hasFollowUp === 'no') where.followUpDate = null;
  if (quoteValueMin || quoteValueMax) {
    where.quoteValue = {
      ...(quoteValueMin && { gte: parseFloat(quoteValueMin) }),
      ...(quoteValueMax && { lte: parseFloat(quoteValueMax) }),
    };
  }
  if (search) {
    andConditions.push({
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { quoteNo: { contains: search, mode: 'insensitive' } },
        { remarks: { contains: search, mode: 'insensitive' } },
      ],
    });
  }
  if (andConditions.length > 0) where.AND = andConditions;

  const skip = (page - 1) * limit;
  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true, name: true, email: true, phone: true, company: true,
        source: true, status: true, leadScore: true, quoteNo: true,
        quoteValue: true, rfqDate: true, followUpDate: true, remarks: true,
        assignedTo: { select: { firstName: true, lastName: true } },
        broughtBy: { select: { firstName: true, lastName: true } },
        linkedCustomer: { select: { id: true, companyName: true } },
        createdAt: true, updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.lead.count({ where }),
  ]);

  return NextResponse.json({
    leads,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  const {
    name, email, phone, company, address, source, assignedToId, broughtById,
    status, quoteNo, quoteValue, rfqDate, followUpDate, expectedClosureDate, remarks,
    solutionAreas, oemNames, presalesIds,
  } = await req.json();

  if (!name || !company) {
    return NextResponse.json({ message: 'Opportunity name and company are required' }, { status: 400 });
  }

  const lead = await prisma.lead.create({
    data: {
      name,
      email: email || `${company.toLowerCase().replace(/\s+/g, '.')}@client.local`,
      phone: phone || null,
      company,
      address: address || null,
      source: source || 'EMAIL',
      status: status || 'SUSPECT',
      leadScore: 0,
      assignedToId: assignedToId || user.id,
      ...(broughtById && { broughtById }),
      ...(quoteNo && { quoteNo }),
      ...(quoteValue !== undefined && quoteValue !== '' && { quoteValue: parseFloat(quoteValue) }),
      ...(rfqDate && { rfqDate: new Date(rfqDate) }),
      ...(followUpDate && { followUpDate: new Date(followUpDate) }),
      ...(expectedClosureDate && { expectedClosureDate: new Date(expectedClosureDate) }),
      ...(remarks && { remarks }),
      ...(solutionAreas && solutionAreas.length > 0 && { solutionAreas }),
      ...(oemNames && oemNames.length > 0 && { oemNames }),
      ...(presalesIds && presalesIds.length > 0 && { presalesIds }),
    },
    include: {
      assignedTo: { select: { firstName: true, lastName: true } },
    },
  });

  return NextResponse.json(lead, { status: 201 });
});
