import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (!['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER'].includes(decoded.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { status, rejectionReason } = await req.json();

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const approvalRequest = await prisma.approvalRequest.update({
      where: { id },
      data: {
        status: status as any,
        approvedBy: decoded.id,
        rejectionReason: status === 'REJECTED' ? rejectionReason : null,
      },
      include: {
        requestedByUser: { select: { firstName: true, lastName: true } },
        lead: { select: { id: true, name: true, company: true } },
      },
    });

    if (status === 'APPROVED' && approvalRequest.lead) {
      await prisma.lead.update({
        where: { id: approvalRequest.lead.id },
        data: { deletedAt: new Date() },
      });
    }

    return NextResponse.json(approvalRequest);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
