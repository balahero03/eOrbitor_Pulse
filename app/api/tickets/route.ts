import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

async function verifyAuth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) throw new Error('Unauthorized');
  return jwt.verify(token, JWT_SECRET) as { id: string; role: string };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const search = searchParams.get('search');
    const customerId = searchParams.get('customerId');

    const skip = (page - 1) * limit;
    const where: any = {};

    // Role-based filtering
    if (auth.role === 'SUPPORT') {
      // Support agents only see tickets assigned to them
      where.assignedToId = auth.id;
    } else if (auth.role === 'SALES_EXEC') {
      // Sales execs see tickets they created
      where.createdById = auth.id;
    } else if (auth.role === 'SALES_MANAGER') {
      // Managers see tickets created by their team
      const subordinates = await prisma.user.findMany({
        where: { managerId: auth.id },
        select: { id: true },
      });
      const teamIds = [auth.id, ...subordinates.map((u: any) => u.id)];
      where.createdById = { in: teamIds };
    }
    // ADMIN sees all tickets — no extra filter

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (customerId) where.customerId = customerId;
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { ticketNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: { customer: true, assignedTo: true, createdBy: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.ticket.count({ where }),
    ]);

    return NextResponse.json({
      tickets,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    const body = await req.json();

    const { customerId, dealId, type, priority, subject, description, assignedToId } = body;

    if (!customerId || !type || !priority || !subject || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Admins/managers can assign to anyone; others are self-assigned
    const resolvedAssignedTo = (
      ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER'].includes(auth.role) && assignedToId
    ) ? assignedToId : auth.id;

    const ticketNumber = `TKT-${Date.now()}`;

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        customerId,
        dealId: dealId || null,
        type,
        priority,
        subject,
        description,
        assignedToId: resolvedAssignedTo,
        createdById: auth.id,
      },
      include: { customer: true, assignedTo: true, createdBy: true },
    });

    return NextResponse.json(ticket, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
  }
}
