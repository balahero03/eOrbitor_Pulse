import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface DecodedToken {
  userId: string;
}

function verifyToken(token: string): DecodedToken | null {
  try {
    return jwt.verify(token, JWT_SECRET) as DecodedToken;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token || !verifyToken(token)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const dealId = searchParams.get('dealId');
  const type = searchParams.get('type');
  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');

  const where: any = {};
  if (dealId) where.dealId = dealId;
  if (type) where.type = type;
  if (fromDate || toDate) {
    where.scheduledDate = {};
    if (fromDate) where.scheduledDate.gte = new Date(fromDate);
    if (toDate) where.scheduledDate.lte = new Date(toDate);
  }

  const [followUps, total] = await Promise.all([
    prisma.followUp.findMany({
      where,
      include: {
        deal: { select: { id: true, dealName: true, customer: { select: { companyName: true } } } },
        lead: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { scheduledDate: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.followUp.count({ where }),
  ]);

  return NextResponse.json({
    followUps,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  const decoded = token ? verifyToken(token) : null;
  if (!decoded) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { dealId, leadId, type, scheduledDate, notes, relatedTaskId } = body;

  if (!dealId || !type || !scheduledDate) {
    return NextResponse.json(
      { message: 'dealId, type, and scheduledDate are required' },
      { status: 400 }
    );
  }

  const followUp = await prisma.followUp.create({
    data: {
      dealId,
      leadId: leadId || null,
      type,
      scheduledDate: new Date(scheduledDate),
      notes: notes || null,
      createdById: decoded.userId,
    },
    include: {
      deal: { select: { id: true, dealName: true, customer: { select: { companyName: true } } } },
      lead: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  // Create related task if relatedTaskId not provided
  if (relatedTaskId) {
    await prisma.task.update({
      where: { id: relatedTaskId },
      data: { relatedFollowUpId: followUp.id },
    });
  }

  return NextResponse.json(followUp, { status: 201 });
}
