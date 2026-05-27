import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

async function verifyAuth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) throw new Error('Unauthorized');

  try {
    return jwt.verify(token, JWT_SECRET) as { id: string; role: string };
  } catch {
    throw new Error('Invalid token');
  }
}

export async function GET(req: NextRequest) {
  try {
    await verifyAuth(req);

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : new Date();

    // Leads by Source
    const leadsBySource = await prisma.lead.groupBy({
      by: ['source'],
      _count: { id: true },
    });

    // Leads by Status
    const leadsByStatus = await prisma.lead.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    // Total Leads
    const totalLeads = await prisma.lead.count();

    // Converted Leads
    const convertedLeads = await prisma.lead.count({
      where: { status: 'CONVERTED' },
    });

    // New Leads (this period)
    const newLeads = await prisma.lead.count({
      where: { createdAt: { gte: startDate, lte: endDate } },
    });

    // Lead Conversion Rate
    const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(2) : '0';

    // Average Lead Score
    const avgLeadScore = await prisma.lead.aggregate({
      _avg: { leadScore: true },
    });

    // Top Sources by Count
    const topSources = leadsBySource
      .sort((a, b) => b._count.id - a._count.id)
      .slice(0, 5);

    return NextResponse.json({
      period: { startDate, endDate },
      summary: {
        total: totalLeads,
        converted: convertedLeads,
        newThisPeriod: newLeads,
        conversionRate: parseFloat(conversionRate),
        averageScore: parseFloat(avgLeadScore._avg.leadScore?.toFixed(2) || '0'),
      },
      bySource: leadsBySource.map(source => ({
        source: source.source,
        count: source._count.id,
      })),
      byStatus: leadsByStatus.map(status => ({
        status: status.status,
        count: status._count.id,
      })),
      topSources: topSources.map(source => ({
        source: source.source,
        count: source._count.id,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch leads report' }, { status: 500 });
  }
}
