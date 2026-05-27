import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (!['ADMIN', 'SALES_MANAGER'].includes(decoded.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'PENDING';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: any = { status };

    if (decoded.role === 'SALES_MANAGER') {
      const subordinates = await prisma.user.findMany({
        where: { managerId: decoded.id },
        select: { id: true },
      });
      const teamIds = [decoded.id, ...subordinates.map((u: any) => u.id)];
      where.requestedByUser = { id: { in: teamIds } };
    }

    const [requests, total] = await Promise.all([
      prisma.approvalRequest.findMany({
        where,
        include: {
          requestedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
          approvedByUser: { select: { id: true, firstName: true, lastName: true } },
          lead: { select: { id: true, name: true, company: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.approvalRequest.count({ where }),
    ]);

    return NextResponse.json({
      requests,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const { entityId, type, reason } = await req.json();

    if (!entityId || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const request = await prisma.approvalRequest.create({
      data: {
        type: type as any,
        entityType: 'LEAD',
        entityId,
        requestedBy: decoded.id,
        reason,
      },
      include: {
        requestedByUser: { select: { firstName: true, lastName: true } },
        lead: { select: { name: true, company: true } },
      },
    });

    return NextResponse.json(request, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
  }
}
