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

    const startDate = new Date(new Date().setMonth(new Date().getMonth() - 1));
    const endDate = new Date();

    // KPI Metrics
    const totalLeads = await prisma.lead.count();
    const totalCustomers = await prisma.customer.count();
    const activeDeals = await prisma.deal.count({
      where: { stage: { not: 'CLOSURE' }, lostReason: null },
    });
    const totalRevenue = await prisma.order.aggregate({
      where: { status: 'COMPLETED', createdAt: { gte: startDate, lte: endDate } },
      _sum: { totalAmount: true },
    });

    // Pipeline Value by Stage
    const pipelineByStage = await prisma.deal.groupBy({
      by: ['stage'],
      _sum: { dealValue: true },
    });

    // Recent Orders
    const recentOrders = await prisma.order.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Open Tickets
    const openTickets = await prisma.ticket.count({
      where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
    });

    // Overdue Tasks
    const overdueTasks = await prisma.task.count({
      where: {
        status: { not: 'COMPLETED' },
        dueDate: { lt: new Date() },
      },
    });

    return NextResponse.json({
      kpis: {
        totalLeads,
        totalCustomers,
        activeDeals,
        totalRevenue: totalRevenue._sum.totalAmount || 0,
        openTickets,
        overdueTasks,
      },
      pipeline: pipelineByStage.map(stage => ({
        stage: stage.stage,
        value: stage._sum.dealValue || 0,
      })),
      recentOrders: recentOrders.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customer.companyName,
        amount: order.totalAmount,
        status: order.paymentStatus,
        createdAt: order.createdAt,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
