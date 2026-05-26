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

    // Get all sales users
    const salesUsers = await prisma.user.findMany({
      where: { role: { in: ['SALES_MANAGER', 'SALES_EXEC'] } },
    });

    // Team Performance
    const teamMetrics = await Promise.all(
      salesUsers.map(async (user) => {
        const dealsAssigned = await prisma.deal.count({
          where: { assignedToId: user.id },
        });

        const dealsWon = await prisma.deal.count({
          where: {
            assignedToId: user.id,
            stage: 'CLOSURE',
            closedAt: { gte: startDate, lte: endDate },
          },
        });

        const dealValue = await prisma.deal.aggregate({
          where: { assignedToId: user.id, stage: 'CLOSURE' },
          _sum: { dealValue: true },
        });

        const leadsAssigned = await prisma.lead.count({
          where: { assignedToId: user.id },
        });

        const leadsConverted = await prisma.lead.count({
          where: { assignedToId: user.id, status: 'CONVERTED' },
        });

        const tasksCompleted = await prisma.task.count({
          where: {
            assignedToId: user.id,
            status: 'COMPLETED',
            completedAt: { gte: startDate, lte: endDate },
          },
        });

        return {
          userId: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          dealsAssigned,
          dealsWon,
          dealValue: dealValue._sum.dealValue || 0,
          leadsAssigned,
          leadsConverted,
          conversionRate:
            leadsAssigned > 0 ? ((leadsConverted / leadsAssigned) * 100).toFixed(2) : '0',
          tasksCompleted,
        };
      })
    );

    return NextResponse.json({
      period: { startDate, endDate },
      team: teamMetrics,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch team report' }, { status: 500 });
  }
}
