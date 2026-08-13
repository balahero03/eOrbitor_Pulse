import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { readStoredFile } from '@/lib/storage';

async function getTeamIds(managerId: string): Promise<string[]> {
  const team = await prisma.user.findMany({ where: { managerId }, select: { id: true } });
  return [managerId, ...team.map((u) => u.id)];
}

async function inScope(user: AuthUser, dealAssignedToId?: string | null): Promise<boolean> {
  if (['SUPER_ADMIN', 'ADMIN'].includes(user.role)) return true;
  if (user.role === 'ON_FIELD_TEAM') return dealAssignedToId === user.id;
  if (user.role === 'BACKEND_TEAM') {
    if (!dealAssignedToId) return false;
    const teamIds = await getTeamIds(user.id);
    return teamIds.includes(dealAssignedToId);
  }
  return false;
}

/**
 * Serve a payment receipt off disk.
 *
 * Mirrors the lead-attachment download route: the bytes never sit in a
 * public directory, so every read is authenticated and scoped the same way as
 * the order it belongs to. `inline` rather than `attachment` so an image or
 * PDF opens in a tab instead of forcing a download.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const { id, paymentId } = await params;

  return withAuth(async (_req: NextRequest, user: AuthUser) => {
    const order = await prisma.order.findUnique({
      where: { id },
      select: { id: true, deal: { select: { assignedToId: true } } },
    });
    if (!order) return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    if (!(await inScope(user, order.deal?.assignedToId))) {
      return NextResponse.json({ message: 'Access denied' }, { status: 403 });
    }

    const payment = await prisma.orderPayment.findFirst({
      where: { id: paymentId, orderId: id },
      select: { proof: true },
    });
    const proof = payment?.proof as any;
    if (!proof?.storagePath) {
      return NextResponse.json({ message: 'No proof filed for this payment' }, { status: 404 });
    }

    const buffer = readStoredFile(proof.storagePath);
    if (!buffer) {
      return NextResponse.json(
        { message: 'The receipt file is no longer on the server' },
        { status: 404 }
      );
    }

    const safeName = String(proof.filename || 'receipt').replace(/["\r\n]/g, '');
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': proof.contentType || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${safeName}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'private, no-store',
      },
    });
  })(req);
}
