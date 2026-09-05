import { NextRequest, NextResponse } from 'next/server';
import { sanitizeSearch, parseEnumParam, parseDateInput, parseIntegerInput } from '@/lib/queryFilters';
import { parseMoneyField } from '@/lib/money';
import { assertRefsExist } from '@/lib/entityRefs';
import { ValidationError } from '@/lib/errors';
import { DealStage } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { parsePagination, paginationMeta } from '@/lib/pagination';
import { withAuth, AuthUser } from '@/lib/middleware/auth';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const stage = parseEnumParam(searchParams.get('stage'), DealStage, 'deal stage');
  const search = sanitizeSearch(searchParams.get('search'));

  const where: any = {};

  // Role-based scoping
  if (user.role === 'ON_FIELD_TEAM') {
    where.assignedToId = user.id;
  } else if (user.role === 'BACKEND_TEAM') {
    const teamMembers = await prisma.user.findMany({
      where: { managerId: user.id },
      select: { id: true },
    });
    const teamIds = [user.id, ...teamMembers.map((u) => u.id)];
    where.assignedToId = { in: teamIds };
  }

  if (stage) where.stage = stage;
  if (search) {
    where.OR = [
      { dealName: { contains: search, mode: 'insensitive' } },
      { customer: { companyName: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [deals, total] = await Promise.all([
    prisma.deal.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true, dealName: true, stage: true, dealValue: true, winProbability: true,
        customer: { select: { id: true, companyName: true } },
        assignedTo: { select: { firstName: true, lastName: true } },
        expectedCloseDate: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.deal.count({ where }),
  ]);

  return NextResponse.json({
    deals,
    pagination: paginationMeta(page, limit, total),
  });
});

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { dealName, customerId, dealValue, winProbability, stage, expectedCloseDate } = await req.json();

  if (!dealName || !customerId || !dealValue) {
    return NextResponse.json(
      { message: 'Deal name, customerId, and dealValue are required' },
      { status: 400 }
    );
  }

  await assertRefsExist([{ id: customerId, model: 'customer', label: 'customer' }]);

  // `dealValue` went into a Decimal column unparsed, so free text failed
  // inside Prisma and came back as "Some values in this request were not
  // valid" — naming neither the field nor the reason. parseMoneyField also
  // accepts the Indian grouping the rest of the app already handles.
  const parsedDealValue = parseMoneyField(dealValue, 'Deal value');
  if (parsedDealValue === undefined) {
    throw new ValidationError('Deal value is required.');
  }

  // winProbability is an Int column and had the same gap.
  const parsedWinProbability = parseIntegerInput(winProbability, 'Win probability', { min: 0, max: 100 });

  const deal = await prisma.deal.create({
    data: {
      dealName,
      customerId,
      dealValue: parsedDealValue,
      winProbability: parsedWinProbability ?? 50,
      stage: stage || 'SUSPECT',
      expectedCloseDate: parseDateInput(expectedCloseDate, 'expected close date') ?? null,
      assignedToId: user.id,
    },
    include: {
      customer: { select: { companyName: true } },
      assignedTo: { select: { firstName: true, lastName: true } },
    },
  });

  return NextResponse.json(deal, { status: 201 });
});
