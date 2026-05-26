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
    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    } catch {
      return NextResponse.json({ message: 'Invalid or expired token — please log out and log in again' }, { status: 401 });
    }
    console.log('LEADS GET - role:', decoded.role, 'id:', decoded.id);

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const source = searchParams.get('source');
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };

    // Role-based visibility
    if (decoded.role === 'SALES_EXEC') {
      // Salesperson sees only leads assigned to them or brought by them
      where.OR = [
        { assignedToId: decoded.id },
        { broughtById: decoded.id },
      ];
    } else if (decoded.role === 'SALES_MANAGER') {
      // Manager sees all leads belonging to their subordinates + their own
      const subordinates = await prisma.user.findMany({
        where: { managerId: decoded.id },
        select: { id: true },
      });
      const teamIds = [decoded.id, ...subordinates.map((u: any) => u.id)];
      where.OR = [
        { assignedToId: { in: teamIds } },
        { broughtById: { in: teamIds } },
      ];
    }
    // ADMIN sees all — no extra filter

    if (status) where.status = status;
    if (source) where.source = source;
    if (search) {
      const searchConditions = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ];
      // Merge search with any existing OR (role filter)
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchConditions }];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          company: true,
          source: true,
          status: true,
          leadScore: true,
          quoteNo: true,
          quoteValue: true,
          rfqDate: true,
          followUpDate: true,
          remarks: true,
          assignedTo: { select: { firstName: true, lastName: true } },
          broughtBy: { select: { firstName: true, lastName: true } },
          linkedCustomer: { select: { id: true, companyName: true } },
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.lead.count({ where }),
    ]);

    return NextResponse.json({
      leads,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('LEADS GET ERROR:', error?.message, error?.code, error?.meta);
    return NextResponse.json({ message: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as any;

    const { name, email, phone, company, source, assignedToId, broughtById, status, quoteNo, quoteValue, rfqDate, followUpDate, remarks } = await req.json();

    if (!name || !company) {
      return NextResponse.json(
        { message: 'Opportunity name and company are required' },
        { status: 400 }
      );
    }

    const lead = await prisma.lead.create({
      data: {
        name,
        email: email || `${company.toLowerCase().replace(/\s+/g, '.')}@client.local`,
        phone: phone || null,
        company,
        source: source || 'EMAIL',
        status: status || 'SUSPECT',
        leadScore: 0,
        assignedToId: assignedToId || decoded.id,
        ...(broughtById && { broughtById }),
        ...(quoteNo && { quoteNo }),
        ...(quoteValue !== undefined && quoteValue !== '' && { quoteValue: parseFloat(quoteValue) }),
        ...(rfqDate && { rfqDate: new Date(rfqDate) }),
        ...(followUpDate && { followUpDate: new Date(followUpDate) }),
        ...(remarks && { remarks }),
      },
      include: {
        assignedTo: { select: { firstName: true, lastName: true } },
      },
    });

    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
