import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { id } = await Promise.resolve().then(() => {
    const url = new URL(req.url);
    return { id: url.pathname.split('/deals/')[1]?.split('/')[0] || '' };
  });

  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      customer: true,
      assignedTo: { select: { firstName: true, lastName: true } },
      activityLogs: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  });

  if (!deal) {
    return NextResponse.json({ message: 'Deal not found' }, { status: 404 });
  }

  return NextResponse.json(deal);
});

export const PATCH = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { id } = await Promise.resolve().then(() => {
    const url = new URL(req.url);
    return { id: url.pathname.split('/deals/')[1]?.split('/')[0] || '' };
  });

  const body = await req.json();
  const { dealName, stage, dealValue, winProbability, expectedCloseDate, nextAction, lostReason } = body;

  const deal = await prisma.deal.update({
    where: { id },
    data: {
      ...(dealName && { dealName }),
      ...(stage && { stage }),
      ...(dealValue !== undefined && { dealValue }),
      ...(winProbability !== undefined && { winProbability }),
      ...(expectedCloseDate && { expectedCloseDate: new Date(expectedCloseDate) }),
      ...(nextAction !== undefined && { nextAction }),
      ...(lostReason !== undefined && { lostReason }),
      ...(stage === 'CLOSURE' || stage === 'ONGOING' ? { closedAt: new Date() } : {}),
    },
  });

  return NextResponse.json(deal);
});

export const DELETE = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { id } = await Promise.resolve().then(() => {
    const url = new URL(req.url);
    return { id: url.pathname.split('/deals/')[1]?.split('/')[0] || '' };
  });

  await prisma.deal.delete({ where: { id } });

  return NextResponse.json({ message: 'Deal deleted successfully' });
});
