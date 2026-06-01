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

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        contacts: { orderBy: { createdAt: 'desc' } },
        deals: {
          select: { id: true, dealName: true, stage: true, dealValue: true, winProbability: true },
          orderBy: { createdAt: 'desc' },
        },
        activityLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });

    if (!customer || customer.deletedAt) {
      return NextResponse.json({ message: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json(customer);
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
    const { companyName, gstNumber, industry, website, annualRevenue, yearEstablished } = body;

    const customer = await prisma.customer.update({
      where: { id: id },
      data: {
        ...(companyName && { companyName }),
        ...(gstNumber && { gstNumber }),
        ...(industry !== undefined && { industry }),
        ...(website !== undefined && { website }),
        ...(annualRevenue !== undefined && { annualRevenue }),
        ...(yearEstablished !== undefined && { yearEstablished }),
      },
    });

    return NextResponse.json(customer);
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

    await Promise.all([
      prisma.customer.update({
        where: { id: id },
        data: { deletedAt: new Date() },
      }),
      prisma.lead.updateMany({
        where: { linkedCustomerId: id },
        data: { linkedCustomerId: null },
      }),
    ]);

    return NextResponse.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
