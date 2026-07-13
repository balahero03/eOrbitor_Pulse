import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { readStoredFile } from '@/lib/storage';

async function getTeamIds(managerId: string): Promise<string[]> {
  const team = await prisma.user.findMany({ where: { managerId }, select: { id: true } });
  return [managerId, ...team.map((u) => u.id)];
}

async function inScope(user: AuthUser, assignedToId: string | null): Promise<boolean> {
  if (['SUPER_ADMIN', 'ADMIN'].includes(user.role)) return true;
  if (user.role === 'ON_FIELD_TEAM') return assignedToId === user.id;
  if (user.role === 'BACKEND_TEAM') {
    if (!assignedToId) return false;
    const teamIds = await getTeamIds(user.id);
    return teamIds.includes(assignedToId);
  }
  return false;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { id, fileId } = await params;

  return withAuth(async (_req: NextRequest, user: AuthUser) => {
    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { deletedAt: true, closureDetails: true, assignedToId: true },
    });

    if (!lead || lead.deletedAt) {
      return NextResponse.json({ message: 'Lead not found' }, { status: 404 });
    }
    if (!(await inScope(user, lead.assignedToId))) {
      return NextResponse.json({ message: 'Access denied' }, { status: 403 });
    }

    const attachments = (lead.closureDetails as any)?.attachments;
    const file = Array.isArray(attachments)
      ? attachments.find((a: any) => a?.id === fileId)
      : null;

    if (!file || !file.storagePath) {
      return NextResponse.json({ message: 'Attachment not found' }, { status: 404 });
    }

    const buffer = readStoredFile(file.storagePath);
    if (!buffer) {
      return NextResponse.json({ message: 'File is no longer available on the server' }, { status: 404 });
    }

    // Sanitize filename for the header
    const safeName = String(file.filename || 'download').replace(/["\r\n]/g, '');

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': file.contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeName}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'private, no-store',
      },
    });
  })(req);
}
