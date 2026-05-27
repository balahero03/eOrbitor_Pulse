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
    const assignedToId = searchParams.get('assignedToId');
    const rfqFrom = searchParams.get('rfqFrom');
    const rfqTo = searchParams.get('rfqTo');
    const followUpFrom = searchParams.get('followUpFrom');
    const followUpTo = searchParams.get('followUpTo');
    const hasFollowUp = searchParams.get('hasFollowUp');
    const quoteValueMin = searchParams.get('quoteValueMin');
    const quoteValueMax = searchParams.get('quoteValueMax');

    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };

    // Role-based visibility
    if (decoded.role === 'SALES_EXEC') {
      where.OR = [
        { assignedToId: decoded.id },
        { broughtById: decoded.id },
      ];
    } else if (decoded.role === 'SALES_MANAGER') {
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

    const andConditions: any[] = [];

    // Role filter already in where.OR — move to AND if we need to add more filters
    if (where.OR) {
      andConditions.push({ OR: where.OR });
      delete where.OR;
    }

    if (status) where.status = status;
    if (source) where.source = source;
    if (assignedToId) where.assignedToId = assignedToId;

    if (rfqFrom || rfqTo) {
      where.rfqDate = {
        ...(rfqFrom && { gte: new Date(rfqFrom) }),
        ...(rfqTo && { lte: new Date(rfqTo + 'T23:59:59') }),
      };
    }
    if (followUpFrom || followUpTo) {
      where.followUpDate = {
        ...(followUpFrom && { gte: new Date(followUpFrom) }),
        ...(followUpTo && { lte: new Date(followUpTo + 'T23:59:59') }),
      };
    }
    if (hasFollowUp === 'yes') where.followUpDate = { not: null };
    if (hasFollowUp === 'no') where.followUpDate = null;

    if (quoteValueMin || quoteValueMax) {
      where.quoteValue = {
        ...(quoteValueMin && { gte: parseFloat(quoteValueMin) }),
        ...(quoteValueMax && { lte: parseFloat(quoteValueMax) }),
      };
    }

    if (search) {
      const searchConditions = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { quoteNo: { contains: search, mode: 'insensitive' } },
        { remarks: { contains: search, mode: 'insensitive' } },
      ];
      andConditions.push({ OR: searchConditions });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
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
