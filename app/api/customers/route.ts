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
    const search = searchParams.get('search');
    const industry = searchParams.get('industry');

    const skip = (page - 1) * limit;
    const where: any = { deletedAt: null };

    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { industry: { contains: search, mode: 'insensitive' } },
        { contacts: { some: { email: { contains: search, mode: 'insensitive' } } } },
      ];
    }
    if (industry) where.industry = industry;

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          companyName: true,
          industry: true,
          website: true,
          annualRevenue: true,
          createdAt: true,
          _count: {
            select: {
              deals: true,
              contacts: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.customer.count({ where }),
    ]);

    const customersWithStats = customers.map(c => ({
      id: c.id,
      companyName: c.companyName,
      industry: c.industry,
      website: c.website,
      annualRevenue: c.annualRevenue,
      createdAt: c.createdAt,
      activeDealCount: c._count.deals,
      contactCount: c._count.contacts,
    }));

    return NextResponse.json({
      customers: customersWithStats,
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

    jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'dev-secret');

    const body = await req.json();
    const { companyName, industry, website, annualRevenue, gstNumber, yearEstablished } = body;

    if (!companyName) {
      return NextResponse.json({ message: 'Company name is required' }, { status: 400 });
    }

    if (!gstNumber) {
      return NextResponse.json({ message: 'GST number is required' }, { status: 400 });
    }

    const customer = await prisma.customer.create({
      data: {
        companyName,
        gstNumber: gstNumber.trim(),
        industry: industry || 'Other',
        website: website || null,
        annualRevenue: annualRevenue || null,
        yearEstablished: yearEstablished || null,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error: any) {
    console.error('Customer POST error:', error?.message, error?.code, error?.meta);
    return NextResponse.json({ message: error?.message || 'Internal server error' }, { status: 500 });
  }
}
