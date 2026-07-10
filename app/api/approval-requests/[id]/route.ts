import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { createNotification } from '@/lib/notify';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (!['SUPER_ADMIN', 'ADMIN', 'BACKEND_TEAM'].includes(decoded.role)) {
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
        requestedByUser: { select: { id: true, firstName: true, lastName: true } },
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
        } else if (originalRequest.type === 'CUSTOMER_DELETE') {
          console.log('[APPROVAL] Soft-deleting customer:', originalRequest.entityId);
          await prisma.customer.update({
            where: { id: originalRequest.entityId },
            data: { deletedAt: new Date() },
          });
        } else {
          console.log('[APPROVAL] No action matched for type:', originalRequest.type);
        }
      } catch (actionError) {
        console.error('[APPROVAL ERROR] Failed to process approval action:', actionError);
        throw actionError;
      }
    }

    // Notify the requester
    const approverName = `${approvalRequest.approvedByUser?.firstName ?? ''} ${approvalRequest.approvedByUser?.lastName ?? ''}`.trim();
    const leadLabel = approvalRequest.lead ? ` for "${approvalRequest.lead.name}"` : '';
    const typeLabel: Record<string, string> = {
      LEAD_DELETE: 'lead deletion',
      LEAD_REOPEN: 'lead reopen',
      ORDER_DELETE: 'order deletion',
      CUSTOMER_DELETE: 'customer deletion',
    };
    const label = typeLabel[originalRequest.type] || originalRequest.type.toLowerCase();
    const notifyEntityType = originalRequest.type.startsWith('ORDER')
      ? 'ORDER'
      : originalRequest.type.startsWith('CUSTOMER')
      ? 'CUSTOMER'
      : 'LEAD';

    if (status === 'APPROVED') {
      await createNotification(
        approvalRequest.requestedByUser.id ?? '',
        'APPROVAL_APPROVED',
        'Request Approved',
        `Your ${label} request${leadLabel} was approved by ${approverName}.`,
        notifyEntityType,
        originalRequest.entityId,
      );
    } else {
      await createNotification(
        approvalRequest.requestedByUser.id ?? '',
        'APPROVAL_REJECTED',
        'Request Rejected',
        `Your ${label} request${leadLabel} was rejected by ${approverName}.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
        notifyEntityType,
        originalRequest.entityId,
      );
    }

    return NextResponse.json(approvalRequest);
  } catch (error) {
    console.error('[APPROVAL ERROR] Failed to process request:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
