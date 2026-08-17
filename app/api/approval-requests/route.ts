import { NextRequest, NextResponse } from 'next/server';
import { parseEnumParam } from '@/lib/queryFilters';
import { ApprovalStatus, ApprovalType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { parsePagination, paginationMeta } from '@/lib/pagination';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { ForbiddenError } from '@/lib/errors';
import { notifyAdminsAndManagers } from '@/lib/notify';
import { assertCanRequest } from '@/lib/approvalScope';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  if (!['SUPER_ADMIN', 'ADMIN', 'BACKEND_TEAM'].includes(user.role)) {
    throw new ForbiddenError();
  }

  const { searchParams } = new URL(req.url);
  const rawStatus = searchParams.get('status');
  const entityId = searchParams.get('entityId');
  const id = searchParams.get('id');
  const { page, limit, skip } = parsePagination(searchParams);

  const where: any = {};

  if (rawStatus && rawStatus !== 'ALL') {
    const status = parseEnumParam(rawStatus, ApprovalStatus, 'approval status');
    if (status) where.status = status;
  } else if (!rawStatus && !entityId && !id) {
    where.status = 'PENDING';
  }

  if (id) {
    where.OR = [{ id }, { entityId: id }, { leadId: id }];
  } else if (entityId) {
    where.OR = [{ entityId }, { id: entityId }, { leadId: entityId }];
  }

  if (user.role === 'BACKEND_TEAM') {
    const subordinates = await prisma.user.findMany({
      where: { managerId: user.id },
      select: { id: true },
    });
    const teamIds = [user.id, ...subordinates.map((u) => u.id)];
    where.requestedByUser = { id: { in: teamIds } };
  }

  const [requests, total] = await Promise.all([
    prisma.approvalRequest.findMany({
      where,
      include: {
        requestedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        approvedByUser: { select: { id: true, firstName: true, lastName: true } },
        targetUser: { select: { id: true, firstName: true, lastName: true } },
        lead: { select: { id: true, name: true, company: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.approvalRequest.count({ where }),
  ]);

  return NextResponse.json({
    requests,
    pagination: paginationMeta(page, limit, total),
  });
});

export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  const { entityId, type, reason } = await req.json();

  if (!entityId || !type) {
    return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
  }

  // `type` went into `type as any` unchecked, so an unrecognised value reached
  // Prisma as an invalid enum and came back as a 500.
  const parsedType = parseEnumParam(type, ApprovalType, 'approval type');

  const entityType =
    parsedType === 'ORDER_DELETE' ? 'ORDER' : parsedType === 'CUSTOMER_DELETE' ? 'CUSTOMER' : 'LEAD';
  // Only lead-type requests carry a leadId FK.
  const isLeadType = entityType === 'LEAD';

  // Nothing previously checked that the target existed, let alone that the
  // requester could see it — see lib/approvalScope.ts for what that allowed
  // when combined with the decide-side check.
  await assertCanRequest(user, entityType, entityId);

  const request = await prisma.approvalRequest.create({
    data: {
      type: parsedType as any,
      entityType,
      entityId,
      leadId: isLeadType ? entityId : null,
      requestedBy: user.id,
      reason,
    },
    include: {
      requestedByUser: { select: { firstName: true, lastName: true } },
      lead: { select: { name: true, company: true } },
    },
  });

  const requesterName = `${request.requestedByUser.firstName} ${request.requestedByUser.lastName}`;
  const leadLabel = request.lead ? ` for "${request.lead.name}"` : '';
  const typeLabel: Record<string, string> = {
    LEAD_DELETE: 'Lead Deletion',
    LEAD_REOPEN: 'Lead Reopen',
    ORDER_DELETE: 'Order Deletion',
    CUSTOMER_DELETE: 'Customer Deletion',
    LEAD_TRANSFER: 'Lead Transfer',
  };
  const label = typeLabel[type] || type;

  await notifyAdminsAndManagers(
    'APPROVAL_REQUESTED',
    `New ${label} Request`,
    `${requesterName} has requested ${label.toLowerCase()}${leadLabel}.`,
    entityType,
    entityId,
    user.id,
  );

  return NextResponse.json(request, { status: 201 });
});
