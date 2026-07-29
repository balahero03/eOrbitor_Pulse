import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/middleware/auth';

// GET /api/users/[id]/records
// Admin/Super-Admin breakdown of everything a user (typically an ex-employee)
// owns. "Business" records have required FKs and block hard-deletion until
// reassigned; "personal" records cascade automatically when the user row is
// deleted. Pass ?detail=true to also get a short list of the actual records
// per category (not just counts) — e.g. which leads, which quotations.
const DETAIL_LIMIT = 25;

export const GET = withAuth(async (req: NextRequest, auth, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;

    if (!['SUPER_ADMIN', 'ADMIN'].includes(auth.role)) {
      return NextResponse.json({ error: 'Only admins can view user records' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const detail = searchParams.get('detail') === 'true';

    const [
      leadsAssigned, leadsBrought, deals, quotations, followUps,
      tasksCreated, tasksAssigned, subordinates,
      dailyActivities, activityLogs, timeLogs,
    ] = await Promise.all([
      prisma.lead.count({ where: { assignedToId: id } }),
      prisma.lead.count({ where: { broughtById: id } }),
      prisma.deal.count({ where: { assignedToId: id } }),
      prisma.quotation.count({ where: { createdById: id } }),
      prisma.followUp.count({ where: { createdById: id } }),
      prisma.task.count({ where: { createdById: id } }),
      prisma.task.count({ where: { assignedToId: id } }),
      prisma.user.count({ where: { managerId: id } }),
      prisma.dailyActivity.count({ where: { userId: id } }),
      prisma.activityLog.count({ where: { userId: id } }),
      prisma.timeLog.count({ where: { userId: id } }),
    ]);

    let items: Record<string, any[]> | undefined;
    if (detail) {
      const [
        leadsAssignedItems, leadsBroughtItems, dealsItems, quotationsItems,
        followUpsItems, tasksCreatedItems, tasksAssignedItems, subordinatesItems,
      ] = await Promise.all([
        leadsAssigned > 0 ? prisma.lead.findMany({ where: { assignedToId: id }, select: { id: true, name: true, company: true, status: true }, orderBy: { createdAt: 'desc' }, take: DETAIL_LIMIT }) : [],
        leadsBrought > 0 ? prisma.lead.findMany({ where: { broughtById: id }, select: { id: true, name: true, company: true, status: true }, orderBy: { createdAt: 'desc' }, take: DETAIL_LIMIT }) : [],
        deals > 0 ? prisma.deal.findMany({ where: { assignedToId: id }, select: { id: true, dealName: true, stage: true, dealValue: true, customer: { select: { companyName: true } } }, orderBy: { createdAt: 'desc' }, take: DETAIL_LIMIT }) : [],
        quotations > 0 ? prisma.quotation.findMany({ where: { createdById: id }, select: { id: true, quotationNumber: true, status: true, totalAmount: true }, orderBy: { createdAt: 'desc' }, take: DETAIL_LIMIT }) : [],
        followUps > 0 ? prisma.followUp.findMany({ where: { createdById: id }, select: { id: true, type: true, scheduledDate: true, outcome: true }, orderBy: { createdAt: 'desc' }, take: DETAIL_LIMIT }) : [],
        tasksCreated > 0 ? prisma.task.findMany({ where: { createdById: id }, select: { id: true, title: true, status: true, dueDate: true }, orderBy: { createdAt: 'desc' }, take: DETAIL_LIMIT }) : [],
        tasksAssigned > 0 ? prisma.task.findMany({ where: { assignedToId: id }, select: { id: true, title: true, status: true, dueDate: true }, orderBy: { createdAt: 'desc' }, take: DETAIL_LIMIT }) : [],
        subordinates > 0 ? prisma.user.findMany({ where: { managerId: id }, select: { id: true, firstName: true, lastName: true, email: true }, take: DETAIL_LIMIT }) : [],
      ]);
      items = {
        leadsAssigned: leadsAssignedItems,
        leadsBrought: leadsBroughtItems,
        deals: dealsItems.map((d: any) => ({ id: d.id, dealName: d.dealName, stage: d.stage, dealValue: d.dealValue, customerName: d.customer?.companyName })),
        quotations: quotationsItems,
        followUps: followUpsItems,
        tasksCreated: tasksCreatedItems,
        tasksAssigned: tasksAssignedItems,
        subordinates: subordinatesItems,
      };
    }

    // Business records require reassignment before the user can be removed.
    // When ?detail=true, each row also carries up to DETAIL_LIMIT actual
    // records (not just the count) plus how many more exist beyond that.
    const business = [
      { key: 'leadsAssigned', label: 'Leads (assigned to them)', count: leadsAssigned },
      { key: 'leadsBrought', label: 'Leads (brought by them)', count: leadsBrought },
      { key: 'deals', label: 'Deals', count: deals },
      { key: 'quotations', label: 'Quotations', count: quotations },
      { key: 'followUps', label: 'Follow-ups', count: followUps },
      { key: 'tasksCreated', label: 'Tasks (created by them)', count: tasksCreated },
      { key: 'tasksAssigned', label: 'Tasks (assigned to them)', count: tasksAssigned },
      { key: 'subordinates', label: 'Team members reporting to them', count: subordinates },
    ].map(row => items ? { ...row, items: items[row.key], moreCount: Math.max(0, row.count - items[row.key].length) } : row);

    // Personal records are deleted automatically with the user (cascade).
    const personal = [
      { key: 'dailyActivities', label: 'Daily activity entries', count: dailyActivities },
      { key: 'activityLogs', label: 'Activity log entries', count: activityLogs },
      { key: 'timeLogs', label: 'Time log entries', count: timeLogs },
    ];

    const businessTotal = business.reduce((s, r) => s + r.count, 0);
    const personalTotal = personal.reduce((s, r) => s + r.count, 0);

    return NextResponse.json({
      business,
      personal,
      businessTotal,
      personalTotal,
      canHardDelete: businessTotal === 0,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to load records' }, { status: 500 });
  }
});
