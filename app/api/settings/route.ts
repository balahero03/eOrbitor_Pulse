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

    const users = await prisma.user.count();
    const leads = await prisma.lead.count();
    const customers = await prisma.customer.count();
    const deals = await prisma.deal.count();

    return NextResponse.json({
      systemStats: {
        totalUsers: users,
        totalLeads: leads,
        totalCustomers: customers,
        totalDeals: deals,
      },
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
        emailNotifications: process.env.SMTP_HOST ? true : false,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}
