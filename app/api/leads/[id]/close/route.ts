import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import { sendMail, buildWonEmail, buildLostEmail, MailAttachment } from '@/lib/mail';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return withAuth(async (req: NextRequest, user: AuthUser) => {
    // Parse multipart form OR JSON
    let outcome: string, reason: string, quoteRef: string, poNumber: string,
        reasonOfWin: string, whatWentWell: string, competitor: string, whatToImprove: string;
    const attachments: MailAttachment[] = [];

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      outcome       = String(form.get('outcome') || '');
      reason        = String(form.get('reason') || '');
      quoteRef      = String(form.get('quoteRef') || '');
      poNumber      = String(form.get('poNumber') || '');
      reasonOfWin   = String(form.get('reasonOfWin') || '');
      whatWentWell  = String(form.get('whatWentWell') || '');
      competitor    = String(form.get('competitor') || '');
      whatToImprove = String(form.get('whatToImprove') || '');

      // Up to 3 file attachments
      for (const key of ['attachment1', 'attachment2', 'attachment3']) {
        const file = form.get(key) as File | null;
        if (file && file.size > 0) {
          const buf = Buffer.from(await file.arrayBuffer());
          attachments.push({ filename: file.name, content: buf, contentType: file.type || 'application/octet-stream' });
        }
      }
    } else {
      const body = await req.json();
      outcome       = body.outcome || '';
      reason        = body.reason || '';
      quoteRef      = body.quoteRef || '';
      poNumber      = body.poNumber || '';
      reasonOfWin   = body.reasonOfWin || '';
      whatWentWell  = body.whatWentWell || '';
      competitor    = body.competitor || '';
      whatToImprove = body.whatToImprove || '';
    }

    if (!['WON', 'LOST', 'DROPPED'].includes(outcome)) {
      throw new ValidationError('outcome must be WON, LOST, or DROPPED');
    }

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        broughtBy:  { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!lead || lead.deletedAt) {
      return NextResponse.json({ message: 'Lead not found' }, { status: 404 });
    }

    const canClose =
      ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER'].includes(user.role) ||
      lead.assignedToId === user.id;
    if (!canClose) throw new ForbiddenError();

    if (lead.status !== 'CLOSURE') {
      throw new ValidationError('Lead must be at CLOSURE stage before closing');
    }

    // Recipients
    const [managers, admins] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: await getManagerIds(lead.assignedToId) } },
        select: { email: true, firstName: true, lastName: true },
      }),
      prisma.user.findMany({
        where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
        select: { email: true, firstName: true, lastName: true },
      }),
    ]);

    const notifyEmails = [...new Set([
      ...managers.map(m => m.email),
      ...admins.map(a => a.email),
    ])].filter(Boolean) as string[];

    const repName     = `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}`;
    const managerName = managers[0] ? `${managers[0].firstName} ${managers[0].lastName}` : 'Manager';
    const attachmentNames = attachments.map(a => a.filename);

    // Closure details stored in JSON
    const closureDetails =
      outcome === 'WON'
        ? { quoteRef, poNumber, reasonOfWin, whatWentWell, attachmentNames }
        : { reason, competitor, whatToImprove, attachmentNames };

    if (outcome === 'WON') {
      const updated = await prisma.lead.update({
        where: { id },
        data: {
          status: 'ORDER' as any,
          closedAt: new Date(),
          closureReason: reasonOfWin || reason || null,
          closureDetails,
        },
        include: {
          assignedTo: { select: { firstName: true, lastName: true } },
          linkedCustomer: { select: { id: true, companyName: true } },
        },
      });

      if (notifyEmails.length > 0) {
        await sendMail({
          to: notifyEmails,
          subject: `🏆 Lead WON — ${lead.company} (${lead.name})${lead.quoteValue ? ` · ₹${Number(lead.quoteValue).toLocaleString('en-IN')}` : ''}`,
          html: buildWonEmail({ lead: { name: lead.name, company: lead.company, quoteValue: lead.quoteValue }, rep: repName, manager: managerName, quoteRef, poNumber, reasonOfWin, whatWentWell, attachmentNames }),
          attachments,
        });
      }

      return NextResponse.json({ outcome: 'WON', lead: updated, message: 'Lead won! Moved to Orders.' });
    }

    // LOST or DROPPED
    const newStatus = outcome === 'LOST' ? 'LOST' : 'DROPPED';

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        status: newStatus as any,
        closedAt: new Date(),
        closureReason: reason || null,
        closureDetails,
      },
      include: { assignedTo: { select: { firstName: true, lastName: true } } },
    });

    if (notifyEmails.length > 0) {
      await sendMail({
        to: notifyEmails,
        subject: `${outcome === 'LOST' ? '❌ Lead LOST' : '🚫 Lead DROPPED'} — ${lead.company} (${lead.name})`,
        html: buildLostEmail({ lead: { name: lead.name, company: lead.company, quoteValue: lead.quoteValue }, outcome: outcome as 'LOST' | 'DROPPED', reason, rep: repName, competitor, whatToImprove, attachmentNames }),
        attachments,
      });
    }

    return NextResponse.json({ outcome: newStatus, lead: updated, message: `Lead marked as ${newStatus}.` });
  })(req);
}

async function getManagerIds(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { managerId: true },
  });
  return user?.managerId ? [user.managerId] : [];
}
