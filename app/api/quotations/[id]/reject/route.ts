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

    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as any;

    const body = await req.json();
    const { rejectionReason } = body;

    const quotation = await prisma.quotation.findUnique({
      where: { id: id },
    });

    if (!quotation) {
      return NextResponse.json({ message: 'Quotation not found' }, { status: 404 });
    }

    // Update status to REJECTED and set rejectionReason field
    const updated = await prisma.quotation.update({
      where: { id: id },
      data: {
        status: 'REJECTED',
        rejectionReason: rejectionReason || '',
      },
      include: {
        customer: { select: { companyName: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('REJECT API ERROR:', error);
    return NextResponse.json({ message: 'Internal server error', error: error?.message || String(error) }, { status: 500 });
  }
}
