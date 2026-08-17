import { NextRequest, NextResponse } from 'next/server';
import { sanitizeSearch, parseDateParam } from '@/lib/queryFilters';
import { startOfIstDay, endOfIstDay, istDateString } from '@/lib/istDate';
import { ValidationError } from '@/lib/errors';
import { prisma } from '@/lib/prisma';
import { parsePagination, paginationMeta } from '@/lib/pagination';
import { withAuth, AuthUser } from '@/lib/middleware/auth';

// The only outcomes this screen is about. `outcome` used to be dropped into
// `status: { in: [outcome] }` verbatim, which had two consequences: an
// unrecognised value reached Prisma as an invalid enum and returned 500, and a
// *valid but open* status like ?outcome=NEGOTIATION listed live leads under
// Closed Leads — a filter that quietly showed the wrong set of records.
const CLOSED_OUTCOMES = ['WON', 'LOST', 'DROPPED', 'ORDER'] as const;

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const outcome = searchParams.get('outcome'); // WON | LOST | DROPPED | ORDER
  const { page, limit, skip } = parsePagination(searchParams);
  const search = sanitizeSearch(searchParams.get('search'));
  const from = parseDateParam(searchParams.get('from'), 'from date');
  const to = parseDateParam(searchParams.get('to'), 'to date');

  if (outcome && !CLOSED_OUTCOMES.includes(outcome as any)) {
    throw new ValidationError(
      `"${outcome}" is not a closed-lead outcome. Expected one of: ${CLOSED_OUTCOMES.join(', ')}.`
    );
  }

  // WON tab shows both WON and ORDER (same business meaning — won deal)
  const closedStatuses = outcome === 'WON'
    ? ['WON', 'ORDER']
    : outcome
      ? [outcome]
      : [...CLOSED_OUTCOMES];

  const where: any = {
    deletedAt: null,
    status: { in: closedStatuses },
  };

  // Role scoping
  if (user.role === 'ON_FIELD_TEAM') {
    where.assignedToId = user.id;
  } else if (user.role === 'BACKEND_TEAM') {
    const team = await prisma.user.findMany({
      where: { managerId: user.id },
      select: { id: true },
    });
    where.assignedToId = { in: [user.id, ...team.map(u => u.id)] };
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { company: { contains: search, mode: 'insensitive' } },
      { quoteNo: { contains: search, mode: 'insensitive' } },
      { leadNumber: { contains: search, mode: 'insensitive' } },
      { assignedTo: { firstName: { contains: search, mode: 'insensitive' } } },
      { assignedTo: { lastName: { contains: search, mode: 'insensitive' } } },
      { assignedTo: { email: { contains: search, mode: 'insensitive' } } },
      { broughtBy: { firstName: { contains: search, mode: 'insensitive' } } },
      { broughtBy: { lastName: { contains: search, mode: 'insensitive' } } },
      { broughtBy: { email: { contains: search, mode: 'insensitive' } } },
    ];
  }

  // IST calendar days — see the same note in /api/leads and /api/followups.
  if (from || to) {
    where.closedAt = {
      ...(from && { gte: startOfIstDay(istDateString(from)) }),
      ...(to && { lte: endOfIstDay(istDateString(to)) }),
    };
  }


  const [leads, total, stats] = await Promise.all([
    prisma.lead.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true, name: true, company: true, status: true,
        quoteValue: true, quoteNo: true, leadNumber: true, source: true,
        closedAt: (true as any),
        closureReason: (true as any),
        assignedTo: { select: { firstName: true, lastName: true } },
        createdAt: true, updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.lead.count({ where }),
    // Summary stats for all closed leads (ignoring current filter)
    prisma.lead.groupBy({
      by: ['status'],
      where: {
        deletedAt: null,
        status: { in: ['WON', 'LOST', 'DROPPED', 'ORDER'] },
        ...(where.assignedToId ? { assignedToId: where.assignedToId } : {}),
      },
      _count: { id: true },
      _sum: { quoteValue: true },
    }),
  ]);

  const statsMap: Record<string, { count: number; value: number }> = {};
  for (const s of stats) {
    statsMap[s.status] = {
      count: s._count.id,
      value: Number(s._sum.quoteValue || 0),
    };
  }

  return NextResponse.json({
    leads,
    pagination: paginationMeta(page, limit, total),
    stats: {
      won: statsMap['WON'] || { count: 0, value: 0 },
      lost: statsMap['LOST'] || { count: 0, value: 0 },
      dropped: statsMap['DROPPED'] || { count: 0, value: 0 },
      order: statsMap['ORDER'] || { count: 0, value: 0 },
    },
  });
});
