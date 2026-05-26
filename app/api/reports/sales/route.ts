import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

async function verifyAuth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) throw new Error('Unauthorized');

  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string };
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

    // Pipeline by Stage
    const dealsByStage = await prisma.deal.groupBy({
      by: ['stage'],
      _count: { id: true },
      _sum: { dealValue: true },
    });

    // Total Pipeline Value
    const totalPipelineValue = await prisma.deal.aggregate({
      _sum: { dealValue: true },
    });

    // Won Deals (CLOSURE stage)
    const wonDeals = await prisma.deal.findMany({
      where: { stage: 'CLOSURE', closedAt: { gte: startDate, lte: endDate } },
    });

    const wonValue = wonDeals.reduce((sum, d) => sum + Number(d.dealValue), 0);

    // Lost Deals
    const lostDeals = await prisma.deal.findMany({
      where: { lostReason: { not: null }, updatedAt: { gte: startDate, lte: endDate } },
    });

    const lostValue = lostDeals.reduce((sum, d) => sum + Number(d.dealValue), 0);

    // Total Deals
    const totalDeals = await prisma.deal.count();

    // Win Rate
    const winRate = totalDeals > 0 ? ((wonDeals.length / totalDeals) * 100).toFixed(2) : '0';

    // Revenue from Orders
    const completedOrders = await prisma.order.findMany({
      where: { status: 'COMPLETED', createdAt: { gte: startDate, lte: endDate } },
    });

    const totalRevenue = completedOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);

    return NextResponse.json({
      period: { startDate, endDate },
      pipeline: {
        totalValue: totalPipelineValue._sum.dealValue || 0,
        byStage: dealsByStage.map(stage => ({
          stage: stage.stage,
          count: stage._count.id,
          value: stage._sum.dealValue || 0,
        })),
      },
      deals: {
        total: totalDeals,
        won: wonDeals.length,
        lost: lostDeals.length,
        active: totalDeals - wonDeals.length - lostDeals.length,
        wonValue,
        lostValue,
        winRate: parseFloat(winRate),
      },
      revenue: {
        completed: totalRevenue,
        ordersCount: completedOrders.length,
        averageOrderValue: completedOrders.length > 0 ? (totalRevenue / completedOrders.length).toFixed(2) : 0,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch sales report' }, { status: 500 });
  }
}
