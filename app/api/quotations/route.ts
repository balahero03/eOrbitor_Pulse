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
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;
    const where: any = {};

    if (status) where.status = status;
    if (search) {
      where.OR = [
        { quotationNumber: { contains: search, mode: 'insensitive' } },
        { customer: { companyName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [quotations, total] = await Promise.all([
      prisma.quotation.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          quotationNumber: true,
          status: true,
          customer: { select: { id: true, companyName: true } },
          deal: { select: { dealName: true } },
          subtotal: true,
          taxAmount: true,
          totalAmount: true,
          issueDate: true,
          expiryDate: true,
          createdBy: { select: { firstName: true, lastName: true } },
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.quotation.count({ where }),
    ]);

    return NextResponse.json({
      quotations,
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
    const { dealId, customerId, items, notes } = body;

    if (!dealId || !customerId || !items || items.length === 0) {
      return NextResponse.json(
        { message: 'dealId, customerId, and items are required' },
        { status: 400 }
      );
    }

    // Calculate totals
    let subtotal = 0;
    let taxAmount = 0;

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        return NextResponse.json(
          { message: `Product ${item.productId} not found` },
          { status: 404 }
        );
      }

      const lineSubtotal = item.quantity * item.unitPrice;
      subtotal += lineSubtotal;

      const lineTax = lineSubtotal * (product.tax / 100);
      taxAmount += lineTax;
    }

    const discountAmount = 0;
    const totalAmount = subtotal + taxAmount - discountAmount;

    // Generate quotation number
    const count = await prisma.quotation.count();
    const quotationNumber = `QT-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    const quotation = await prisma.quotation.create({
      data: {
        quotationNumber,
        dealId,
        customerId,
        status: 'DRAFT',
        items: items,
        subtotal: subtotal.toString(),
        taxAmount: taxAmount.toString(),
        discountAmount: '0',
        totalAmount: totalAmount.toString(),
        issueDate: new Date(),
        notes,
        createdById: decoded.userId,
      },
      include: {
        customer: { select: { companyName: true } },
        deal: { select: { dealName: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });

    return NextResponse.json(quotation, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
