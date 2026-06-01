import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { ForbiddenError } from '@/lib/errors';

export const GET = withAuth(async (req: NextRequest, user: AuthUser) => {
  if (!['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
    throw new ForbiddenError();
  }

  const [users, leads, customers, deals] = await Promise.all([
    prisma.user.count(),
    prisma.lead.count(),
    prisma.customer.count(),
    prisma.deal.count(),
  ]);

  return NextResponse.json({
    systemStats: { totalUsers: users, totalLeads: leads, totalCustomers: customers, totalDeals: deals },
    emailConfig: {
      provider: process.env.EMAIL_PROVIDER || 'SMTP',
      host: process.env.SMTP_HOST || 'localhost',
      port: process.env.SMTP_PORT || 587,
      senderEmail: process.env.SENDER_EMAIL || 'noreply@eorbitor.local',
    },
    features: {
      realTimeNotifications: true,
      activityLogging: true,
      roleBasedAccess: true,
      emailNotifications: !!process.env.SMTP_HOST,
    },
  });
});
