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

    jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'dev-secret');

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const stage = searchParams.get('stage');
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;
    const where: any = { deletedAt: null };

    if (stage) where.stage = stage;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { customer: { companyName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [deals, total] = await Promise.all([
      prisma.deal.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          stage: true,
          value: true,
          probability: true,
          customer: { select: { id: true, companyName: true } },
          createdBy: { select: { firstName: true, lastName: true } },
          expectedClosureDate: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.deal.count({ where }),
    ]);

    return NextResponse.json({
      deals,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
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

    const body = await req.json();
    const { name, customerId, value, probability, stage, expectedClosureDate } = body;

    if (!name || !customerId || !value) {
      return NextResponse.json({ message: 'Name, customerId, and value are required' }, { status: 400 });
    }

    const deal = await prisma.deal.create({
      data: {
        name,
        customerId,
        value,
        probability: probability || 50,
        stage: stage || 'SUSPECT',
        expectedClosureDate: expectedClosureDate ? new Date(expectedClosureDate) : null,
        createdById: decoded.userId,
      },
      include: {
        customer: { select: { companyName: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });

    return NextResponse.json(deal, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
