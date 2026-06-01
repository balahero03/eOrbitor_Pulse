import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';


export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'dev-secret');

    const body = await req.json();
    const { amountPaid } = body;

    if (amountPaid === undefined || amountPaid <= 0) {
      return NextResponse.json(
        { message: 'Valid amount must be provided' },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: id },
    });

    if (!order) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }

    const currentAmountPaid = parseFloat(order.amountPaid.toString());
    const newAmountPaid = currentAmountPaid + amountPaid;
    const totalAmount = parseFloat(order.totalAmount.toString());

    let paymentStatus = 'PENDING';
    if (newAmountPaid >= totalAmount) {
      paymentStatus = 'COMPLETED';
    } else if (newAmountPaid > 0) {
      paymentStatus = 'PARTIAL';
    }

    const updated = await prisma.order.update({
      where: { id: id },
      data: {
        amountPaid: newAmountPaid.toString(),
        paymentStatus: paymentStatus as any,
      },
      include: {
        customer: { select: { companyName: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
