import { NextRequest, NextResponse } from 'next/server';
import { sanitizeSearch, parseEnumParam, parseDateParam, parseNumberParam, parseDateInput } from '@/lib/queryFilters';
import { LeadSource, LeadStatus } from '@prisma/client';
import { startOfIstDay, endOfIstDay, istDateString } from '@/lib/istDate';
import { prisma } from '@/lib/prisma';
import { parsePagination, paginationMeta } from '@/lib/pagination';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { createWithLeadNumber } from '@/lib/leadNumber';
import { parseMoneyField } from '@/lib/money';
import { assertAssignableUsers } from '@/lib/userRefs';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const status = parseEnumParam(searchParams.get('status'), LeadStatus, 'lead status');
  const source = parseEnumParam(searchParams.get('source'), LeadSource, 'lead source');
  const search = sanitizeSearch(searchParams.get('search'));
  const assignedToId = searchParams.get('assignedToId');
  // Validated rather than handed straight to Prisma. `new Date('xx')` is an
  // Invalid Date and `parseFloat('abc')` is NaN; both were passed through to
  // the `where` clause, where Prisma rejected them and the route answered 500.
  // The same sweep that fixed this across the other list endpoints missed the
  // date and number filters here.
  const rfqFrom = parseDateParam(searchParams.get('rfqFrom'), 'RFQ from date');
  const rfqTo = parseDateParam(searchParams.get('rfqTo'), 'RFQ to date');
  const followUpFrom = parseDateParam(searchParams.get('followUpFrom'), 'follow-up from date');
  const followUpTo = parseDateParam(searchParams.get('followUpTo'), 'follow-up to date');
  const hasFollowUp = searchParams.get('hasFollowUp');
  const quoteValueMin = parseNumberParam(searchParams.get('quoteValueMin'), 'minimum quote value');
  const quoteValueMax = parseNumberParam(searchParams.get('quoteValueMax'), 'maximum quote value');

  // Active leads only — closed leads live in /api/leads/closed.
  //
  // DROPPED belongs here. It was missing, so a dropped lead stayed in the
  // active pipeline while also appearing under Closed Leads — counted twice,
  // and still shown to the rep as something to work. /api/leads/closed,
  // /api/leads/[id]/close and lib/reports/calculator.ts all already treat
  // DROPPED as closed; this list was the one place that did not.
  const CLOSED_STATUSES = ['WON', 'LOST', 'DROPPED', 'ORDER'];
  const where: any = {
    deletedAt: null,
  };
  const andConditions: any[] = [];

  // Role-based data scoping
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
  // ADMIN/SUPER_ADMIN see all — no extra filter

  if (status) {
    where.status = status;
  } else {
    where.status = { notIn: CLOSED_STATUSES };
  }
  if (source) where.source = source;
  // Only allow assignedToId filter override for managers/admins
  if (assignedToId && ['SUPER_ADMIN', 'ADMIN', 'BACKEND_TEAM'].includes(user.role)) {
    where.assignedToId = assignedToId;
  }

  // Anchored to IST calendar days, matching /api/followups. `new Date(to +
  // 'T23:59:59')` was parsed in the *server's* timezone, so on a UTC container
  // the "to" day actually ran until 05:29 IST the next morning and pulled in
  // records the user had not asked for.
  if (rfqFrom || rfqTo) {
    where.rfqDate = {
      ...(rfqFrom && { gte: startOfIstDay(istDateString(rfqFrom)) }),
      ...(rfqTo && { lte: endOfIstDay(istDateString(rfqTo)) }),
    };
  }
  // `hasFollowUp` is applied through AND rather than by assigning to
  // `where.followUpDate`, which silently discarded any date range set just
  // above it — "has a follow-up" and "in this window" are not alternatives.
  if (followUpFrom || followUpTo) {
    andConditions.push({
      followUpDate: {
        ...(followUpFrom && { gte: startOfIstDay(istDateString(followUpFrom)) }),
        ...(followUpTo && { lte: endOfIstDay(istDateString(followUpTo)) }),
      },
    });
  }
  if (hasFollowUp === 'yes') andConditions.push({ followUpDate: { not: null } });
  if (hasFollowUp === 'no') andConditions.push({ followUpDate: null });
  if (quoteValueMin !== undefined || quoteValueMax !== undefined) {
    where.quoteValue = {
      ...(quoteValueMin !== undefined && { gte: quoteValueMin }),
      ...(quoteValueMax !== undefined && { lte: quoteValueMax }),
    };
  }
  if (search) {
    andConditions.push({
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { quoteNo: { contains: search, mode: 'insensitive' } },
        { leadNumber: { contains: search, mode: 'insensitive' } },
        { remarks: { contains: search, mode: 'insensitive' } },
        { assignedTo: { firstName: { contains: search, mode: 'insensitive' } } },
        { assignedTo: { lastName: { contains: search, mode: 'insensitive' } } },
        { assignedTo: { email: { contains: search, mode: 'insensitive' } } },
        { broughtBy: { firstName: { contains: search, mode: 'insensitive' } } },
        { broughtBy: { lastName: { contains: search, mode: 'insensitive' } } },
        { broughtBy: { email: { contains: search, mode: 'insensitive' } } },
      ],
    });
  }
  if (andConditions.length > 0) where.AND = andConditions;

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true, name: true, email: true, phone: true, company: true,
        source: true, status: true, leadScore: true, quoteNo: true, leadNumber: true,
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
    pagination: paginationMeta(page, limit, total),
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

  // Validated here for the same reason GET already validates its filters:
  // an invalid value reached `prisma.lead.create()` unchecked and came back
  // as a raw "Invalid value for argument `source`. Expected LeadSource."
  // straight from Prisma — confirmed live, from the create form's own
  // Source dropdown once offering "WhatsApp" and "Campaign", neither of
  // which was ever a real value. `status` has the same gap and no form
  // currently exercises it, but a direct API call could, so it gets the
  // same guard rather than waiting for its own incident to prove the point.
  const parsedSource = parseEnumParam(source, LeadSource, 'lead source');
  const parsedStatus = parseEnumParam(status, LeadStatus, 'lead status');

  // An unknown id here is a foreign-key violation (a 500), and an ex-employee's
  // id passes the foreign key but drops the lead out of every scoped list the
  // moment it is created. See lib/userRefs.ts.
  await assertAssignableUsers([assignedToId, broughtById, ...(Array.isArray(presalesIds) ? presalesIds : [])]);

  // Rejects a typo instead of silently dropping it — "12o000" used to save
  // the lead with no quote value at all and report success.
  const parsedQuoteValue = parseMoneyField(quoteValue, 'Quote value');

  // The lead number is issued by the server, never taken from the request:
  // it is an identity, and letting a caller choose it is what allowed
  // duplicates and stray quotation numbers into the field. Anything the user
  // typed stays in `quoteNo`, which is free-text reference data.
  const lead = await createWithLeadNumber((leadNumber) =>
    prisma.lead.create({
      data: {
        leadNumber,
        name,
        email: email || `${company.toLowerCase().replace(/\s+/g, '.')}@client.local`,
        phone: phone || null,
        company,
        address: address || null,
        source: parsedSource || 'EMAIL',
        status: parsedStatus || 'SUSPECT',
        leadScore: 0,
        assignedToId: assignedToId || user.id,
        ...(quoteNo && { quoteNo }),
        ...(broughtById && { broughtById }),
        ...(parsedQuoteValue !== undefined && { quoteValue: parsedQuoteValue }),
        ...(rfqDate && { rfqDate: parseDateInput(rfqDate, 'RFQ date') }),
        ...(followUpDate && { followUpDate: parseDateInput(followUpDate, 'follow-up date') }),
        ...(expectedClosureDate && { expectedClosureDate: parseDateInput(expectedClosureDate, 'expected closure date') }),
        ...(remarks && { remarks }),
        ...(solutionAreas && solutionAreas.length > 0 && { solutionAreas }),
        ...(oemNames && oemNames.length > 0 && { oemNames }),
        ...(presalesIds && presalesIds.length > 0 && { presalesIds }),
      },
      include: {
        assignedTo: { select: { firstName: true, lastName: true } },
      },
    })
  );

  return NextResponse.json(lead, { status: 201 });
});
