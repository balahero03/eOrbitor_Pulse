import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');

    const [totalLeads, activeDeals, pendingTasks, totalRevenue] = await Promise.all([
      prisma.lead.count({ where: { deletedAt: null } }),
      prisma.deal.count({ where: { stage: { not: 'CLOSURE' } } }),
      prisma.task.count({ where: { status: { in: ['TODO', 'IN_PROGRESS'] } } }),
      prisma.order.aggregate({ _sum: { totalAmount: true }, where: { paymentStatus: 'COMPLETED' } }),
    ]);

    return NextResponse.json({
      totalLeads,
      activeDeals,
      pendingTasks,
      yTDRevenue: totalRevenue._sum.totalAmount || 0,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
}
