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

    // First, fetch the original request to get its type
    const originalRequest = await prisma.approvalRequest.findUnique({
      where: { id },
      select: { type: true, entityId: true, leadId: true },
    });

    if (!originalRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Update the approval status
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
        approvedByUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Process the approval action
    if (status === 'APPROVED') {
      try {
        console.log('[APPROVAL] Processing approved request:', {
          id,
          type: originalRequest.type,
          leadId: originalRequest.leadId,
          entityId: originalRequest.entityId,
        });

        if (originalRequest.type === 'LEAD_DELETE' && originalRequest.leadId) {
          console.log('[APPROVAL] Deleting lead:', originalRequest.leadId);
          const updatedLead = await prisma.lead.update({
            where: { id: originalRequest.leadId },
            data: { deletedAt: new Date() },
          });
          console.log('[APPROVAL] Lead deleted successfully:', updatedLead.id, updatedLead.deletedAt);
        } else if (originalRequest.type === 'LEAD_REOPEN' && originalRequest.leadId) {
          console.log('[APPROVAL] Reopening lead:', originalRequest.leadId);
          await prisma.lead.update({
            where: { id: originalRequest.leadId },
            data: { deletedAt: null, status: 'SUSPECT' },
          });
        } else if (originalRequest.type === 'ORDER_DELETE') {
          console.log('[APPROVAL] Deleting order:', originalRequest.entityId);
          await prisma.order.delete({ where: { id: originalRequest.entityId } });
        } else {
          console.log('[APPROVAL] No action matched for type:', originalRequest.type);
        }
      } catch (actionError) {
        console.error('[APPROVAL ERROR] Failed to process approval action:', actionError);
        throw actionError;
      }
    }

    return NextResponse.json(approvalRequest);
  } catch (error) {
    console.error('[APPROVAL ERROR] Failed to process request:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
