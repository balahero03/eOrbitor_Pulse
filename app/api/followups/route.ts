import { NextRequest, NextResponse } from 'next/server';
import { sanitizeSearch, parseEnumParam, parseDateParam } from '@/lib/queryFilters';
import { istDateString, startOfIstDay, endOfIstDay } from '@/lib/istDate';
import { FollowUpType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { parsePagination, paginationMeta } from '@/lib/pagination';
import { withAuth, AuthUser } from '@/lib/middleware/auth';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const dealId = searchParams.get('dealId');
  const type = parseEnumParam(searchParams.get('type'), FollowUpType, 'follow-up type');
  const fromDate = parseDateParam(searchParams.get('fromDate'), 'from date');
  const toDate = parseDateParam(searchParams.get('toDate'), 'to date');
  const search = sanitizeSearch(searchParams.get('search'));
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
      // Anchored to IST calendar days. `new Date(toDate + 'T23:59:59')` was
      // parsed in the *server's* timezone, so on a UTC container the "to" day
      // ran to 05:29 IST the following morning — the same class of bug as the
      // report range boundaries.
      ...(fromDate && { gte: startOfIstDay(istDateString(fromDate)) }),
      ...(toDate && { lte: endOfIstDay(istDateString(toDate)) }),
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
      skip,
      take: limit,
    }),
    prisma.followUp.count({ where }),
  ]);

  return NextResponse.json({
    followUps,
    pagination: paginationMeta(page, limit, total),
  });
});

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { dealId, leadId, type, scheduledDate, notes, relatedTaskId } = await req.json();

  if (!type || !scheduledDate) {
    return NextResponse.json({ message: 'type and scheduledDate are required' }, { status: 400 });
  }
  // FollowUp.dealId is non-nullable, so `dealId || null` handed Prisma a null
  // for a required relation and the request died as an unhandled 500. The form
  // already marks the deal mandatory; this makes the API agree with it and say
  // so, instead of failing as a server error for any other caller.
  if (!dealId) {
    return NextResponse.json(
      { message: 'A follow-up must be linked to a deal. Pass dealId (leadId alone is not enough).' },
      { status: 400 }
    );
  }

  const followUp = await prisma.followUp.create({
    data: {
      dealId,
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
