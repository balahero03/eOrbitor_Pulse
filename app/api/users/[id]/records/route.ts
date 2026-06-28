import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function verifyAuth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) throw new Error('Unauthorized');
  return jwt.verify(token, JWT_SECRET) as { id: string; role: string };
}

// GET /api/users/[id]/records
// Super-Admin-only breakdown of everything an ex-employee owns. "Business"
// records have required FKs and block hard-deletion until reassigned; "personal"
// records cascade automatically when the user row is deleted.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = verifyAuth(req);

    if (auth.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only the Super Admin can view ex-employee records' }, { status: 403 });
    }

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

    // Business records require reassignment before the user can be removed.
    const business = [
      { key: 'leadsAssigned', label: 'Leads (assigned to them)', count: leadsAssigned },
      { key: 'leadsBrought', label: 'Leads (brought by them)', count: leadsBrought },
      { key: 'deals', label: 'Deals', count: deals },
      { key: 'quotations', label: 'Quotations', count: quotations },
      { key: 'followUps', label: 'Follow-ups', count: followUps },
      { key: 'tasksCreated', label: 'Tasks (created by them)', count: tasksCreated },
      { key: 'tasksAssigned', label: 'Tasks (assigned to them)', count: tasksAssigned },
      { key: 'subordinates', label: 'Team members reporting to them', count: subordinates },
    ];

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
}
