import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';


export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'dev-secret');

    const order = await prisma.order.findUnique({
      where: { id: id },
      include: {
        customer: true,
        quotation: true,
        deal: true,
      },
    });

    if (!order) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'dev-secret');

    const body = await req.json();
    const { status, paymentStatus, amountPaid, totalAmount, deliveryDate, poNumber, poDate, paymentMode, paymentRemarks, paymentProofUrl } = body;

    const updateData: any = {};

    if (status) updateData.status = status;
    if (paymentStatus) updateData.paymentStatus = paymentStatus;
    if (amountPaid !== undefined) {
      const paid = parseFloat(amountPaid);
      const total = totalAmount !== undefined ? parseFloat(totalAmount) : null;
      updateData.amountPaid = paid.toString();
      if (total !== null) {
        updateData.paymentStatus = paid >= total && paid > 0 ? 'COMPLETED' : paid > 0 ? 'PARTIAL' : 'PENDING';
      }
    }
    if (totalAmount !== undefined) updateData.totalAmount = parseFloat(totalAmount).toString();
    if (deliveryDate) updateData.deliveryDate = new Date(deliveryDate);
    if (poNumber !== undefined) updateData.poNumber = poNumber || null;
    if (poDate !== undefined) updateData.poDate = poDate ? new Date(poDate) : null;
    if (paymentMode !== undefined) updateData.paymentMode = paymentMode || null;
    if (paymentRemarks !== undefined) updateData.paymentRemarks = paymentRemarks || null;
    if (paymentProofUrl !== undefined) updateData.paymentProofUrl = paymentProofUrl || null;

    const order = await prisma.order.update({
      where: { id: id },
      data: updateData,
    });

    return NextResponse.json(order);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'dev-secret');

    await prisma.order.delete({
      where: { id: id },
    });

    return NextResponse.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
