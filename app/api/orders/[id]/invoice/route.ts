import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { readStoredFile, fileResponseHeaders } from '@/lib/storage';

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

/** Serve the uploaded invoice off disk, scoped like the order it belongs to. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return withAuth(async (_req: NextRequest, user: AuthUser) => {
    const order = await prisma.order.findUnique({
      where: { id },
      select: { invoiceFile: true, deal: { select: { assignedToId: true } } },
    });
    if (!order) return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    if (!(await inScope(user, order.deal?.assignedToId))) {
      return NextResponse.json({ message: 'Access denied' }, { status: 403 });
    }

    const file = order.invoiceFile as any;
    if (!file?.storagePath) {
      return NextResponse.json({ message: 'No invoice uploaded' }, { status: 404 });
    }

    const buffer = readStoredFile(file.storagePath);
    if (!buffer) {
      return NextResponse.json({ message: 'The invoice file is no longer on the server' }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: fileResponseHeaders({
        storagePath: file.storagePath,
        filename: file.filename,
        size: buffer.length,
        preferInline: true,
      }),
    });
  })(req);
}
