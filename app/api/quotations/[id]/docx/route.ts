import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { NotFoundError, ForbiddenError } from '@/lib/errors';
import { generateQuotationDocx } from '@/lib/quotation-docx';

async function getTeamIds(managerId: string): Promise<string[]> {
  const team = await prisma.user.findMany({ where: { managerId }, select: { id: true } });
  return [managerId, ...team.map((u) => u.id)];
}

async function inScope(user: AuthUser, createdById: string): Promise<boolean> {
  if (['SUPER_ADMIN', 'ADMIN'].includes(user.role)) return true;
  if (user.id === createdById) return true;
  if (user.role === 'BACKEND_TEAM') {
    const teamIds = await getTeamIds(user.id);
    return teamIds.includes(createdById);
  }
  return false;
}

export const GET = withAuth(async (req: NextRequest, user: AuthUser, context?: any) => {
  const params = await context?.params;
  const id = params?.id || req.nextUrl.pathname.split('/')[3];

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      customer: true,
      deal: true,
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
          phone: true,
          email: true,
        },
      },
    },
  });

  if (!quotation) throw new NotFoundError('Quotation');
  if (!(await inScope(user, quotation.createdById))) throw new ForbiddenError();

  let leadInfo: { name?: string; company?: string } | null = null;
  const leadOrDealId = quotation.leadId || quotation.dealId;
  if (leadOrDealId) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadOrDealId, deletedAt: null },
      select: { name: true, company: true },
    });
    if (lead) {
      leadInfo = lead;
    }
  }

  const docxBuffer = await generateQuotationDocx({
    quotationNumber: quotation.quotationNumber,
    issueDate: quotation.issueDate,
    expiryDate: quotation.expiryDate,
    customer: quotation.customer,
    deal: quotation.deal,
    lead: leadInfo,
    items: quotation.items as any,
    subtotal: quotation.subtotal.toString(),
    taxAmount: quotation.taxAmount?.toString(),
    discountAmount: quotation.discountAmount?.toString(),
    totalAmount: quotation.totalAmount.toString(),
    priceValidity: quotation.priceValidity,
    taxDetails: quotation.taxDetails,
    warranty: quotation.warranty,
    amcPeriod: quotation.amcPeriod,
    deliveryEstimate: quotation.deliveryEstimate,
    paymentTerms: quotation.paymentTerms,
    notes: quotation.notes,
    createdBy: quotation.createdBy,
  });

  const safeFilename = `${quotation.quotationNumber.replace(/[^a-zA-Z0-9_.-]/g, '_')}.docx`;

  return new NextResponse(new Uint8Array(docxBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`,
      'Content-Length': docxBuffer.length.toString(),
    },
  });
});
