import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { ForbiddenError } from '@/lib/errors';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  if (!['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER'].includes(user.role)) {
    throw new ForbiddenError();
  }

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('startDate')
    ? new Date(searchParams.get('startDate')!)
    : new Date(new Date().setMonth(new Date().getMonth() - 1));
  const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : new Date();

  const [ordersByStatus, ordersByPaymentStatus, completedOrders, pendingOrders, paidOrders] =
    await Promise.all([
      prisma.order.groupBy({ by: ['status'], _count: { id: true }, _sum: { totalAmount: true } }),
      prisma.order.groupBy({ by: ['paymentStatus'], _count: { id: true }, _sum: { totalAmount: true } }),
      prisma.order.findMany({
        where: { status: 'COMPLETED', createdAt: { gte: startDate, lte: endDate } },
      }),
      prisma.order.findMany({
        where: { paymentStatus: 'PENDING', createdAt: { gte: startDate, lte: endDate } },
      }),
      prisma.order.findMany({
        where: { paymentStatus: 'COMPLETED', createdAt: { gte: startDate, lte: endDate } },
      }),
    ]);

  const totalRevenue = completedOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
  const pendingRevenue = pendingOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
  const paidRevenue = paidOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);

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
        const customer = await prisma.customer.findUnique({ where: { id: item.customerId } });
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
      byStatus: ordersByStatus.map((s) => ({ status: s.status, count: s._count.id, value: s._sum.totalAmount || 0 })),
      byPaymentStatus: ordersByPaymentStatus.map((s) => ({ status: s.paymentStatus, count: s._count.id, value: s._sum.totalAmount || 0 })),
    },
    topCustomers: topCustomersWithNames,
  });
});
