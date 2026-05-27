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

    // Revenue by Order Status
    const ordersByStatus = await prisma.order.groupBy({
      by: ['status'],
      _count: { id: true },
      _sum: { totalAmount: true },
    });

    // Payment Status
    const ordersByPaymentStatus = await prisma.order.groupBy({
      by: ['paymentStatus'],
      _count: { id: true },
      _sum: { totalAmount: true },
    });

    // Total Revenue (Completed Orders)
    const completedOrders = await prisma.order.findMany({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    const totalRevenue = completedOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);

    // Pending Revenue
    const pendingOrders = await prisma.order.findMany({
      where: {
        paymentStatus: 'PENDING',
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    const pendingRevenue = pendingOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);

    // Paid Revenue
    const paidOrders = await prisma.order.findMany({
      where: {
        paymentStatus: 'COMPLETED',
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    const paidRevenue = paidOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);

    // Top Customers by Revenue
    const topCustomers = await prisma.order.groupBy({
      by: ['customerId'],
      _sum: { totalAmount: true },
      _count: { id: true },
    });

    const topCustomersWithNames = await Promise.all(
      topCustomers
        .sort((a, b) => (Number(b._sum.totalAmount) || 0) - (Number(a._sum.totalAmount) || 0))
        .slice(0, 10)
        .map(async (item) => {
          const customer = await prisma.customer.findUnique({
            where: { id: item.customerId },
          });
          return {
            customerId: item.customerId,
            customerName: customer?.companyName || 'Unknown',
            orders: item._count.id,
            totalRevenue: item._sum.totalAmount || 0,
          };
        })
    );

    return NextResponse.json({
      period: { startDate, endDate },
      revenue: {
        completed: totalRevenue,
        pending: pendingRevenue,
        paid: paidRevenue,
        unpaid: totalRevenue - paidRevenue,
      },
      orders: {
        byStatus: ordersByStatus.map(status => ({
          status: status.status,
          count: status._count.id,
          value: status._sum.totalAmount || 0,
        })),
        byPaymentStatus: ordersByPaymentStatus.map(ps => ({
          status: ps.paymentStatus,
          count: ps._count.id,
          value: ps._sum.totalAmount || 0,
        })),
      },
      topCustomers: topCustomersWithNames,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch revenue report' }, { status: 500 });
  }
}
