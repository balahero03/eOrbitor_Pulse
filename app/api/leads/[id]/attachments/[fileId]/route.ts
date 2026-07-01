import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { readStoredFile } from '@/lib/storage';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { id, fileId } = await params;

  return withAuth(async (_req: NextRequest, _user: AuthUser) => {
    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { deletedAt: true, closureDetails: true },
    });

    if (!lead || lead.deletedAt) {
      return NextResponse.json({ message: 'Lead not found' }, { status: 404 });
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
