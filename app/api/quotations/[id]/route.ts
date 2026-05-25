import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'dev-secret');

    const quotation = await prisma.quotation.findUnique({
      where: { id: params.id },
      include: {
        customer: true,
        deal: true,
        createdBy: { select: { firstName: true, lastName: true } },
        orders: { where: { quotationId: params.id } },
      },
    });

    if (!quotation) {
      return NextResponse.json({ message: 'Quotation not found' }, { status: 404 });
    }

    return NextResponse.json(quotation);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'dev-secret');

    const body = await req.json();
    const { status, notes, items } = body;

    let updateData: any = {};

    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    // If items updated, recalculate totals
    if (items && items.length > 0) {
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

      const totalAmount = subtotal + taxAmount;

      updateData.items = items;
      updateData.subtotal = subtotal.toString();
      updateData.taxAmount = taxAmount.toString();
      updateData.totalAmount = totalAmount.toString();
      updateData.revision = { increment: 1 };
    }

    const quotation = await prisma.quotation.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json(quotation);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'dev-secret');

    await prisma.quotation.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: 'Quotation deleted successfully' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
