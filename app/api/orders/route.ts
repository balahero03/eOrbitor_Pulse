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
    const status = searchParams.get('status');
    const paymentStatus = searchParams.get('paymentStatus');
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;
    const where: any = {};

    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customer: { companyName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          orderNumber: true,
          poNumber: true,
          status: true,
          paymentStatus: true,
          customer: { select: { id: true, companyName: true } },
          quotation: { select: { quotationNumber: true } },
          totalAmount: true,
          amountPaid: true,
          poDate: true,
          deliveryDate: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({
      orders,
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
    const { quotationId, customerId, dealId, poNumber, poDate, totalAmount } = body;

    if (!customerId || !totalAmount) {
      return NextResponse.json(
        { message: 'customerId and totalAmount are required' },
        { status: 400 }
      );
    }

    // Generate order number
    const count = await prisma.order.count();
    const orderNumber = `ORD-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const order = await prisma.order.create({
      data: {
        orderNumber,
        quotationId: quotationId || null,
        customerId,
        dealId: dealId || null,
        poNumber: poNumber || null,
        poDate: poDate ? new Date(poDate) : null,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        totalAmount: totalAmount.toString(),
        amountPaid: '0',
      },
      include: {
        customer: { select: { companyName: true } },
        quotation: { select: { quotationNumber: true } },
        deal: { select: { dealName: true } },
      },
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
