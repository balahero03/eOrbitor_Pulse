import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/middleware/auth';


// POST /api/leads/[id]/followups
// Adds a follow-up to a lead. Auto-creates a stub customer+deal if the lead
// hasn't been converted yet, so the user never has to do it manually first.
export const POST = withAuth(async (
  req: NextRequest,
  user,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id: leadId } = await params;

    const body = await req.json();
    const { type, scheduledDate, notes, outcome } = body;

    if (!type || !scheduledDate) {
      return NextResponse.json({ message: 'type and scheduledDate are required' }, { status: 400 });
    }

    // Load the lead
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { linkedCustomer: true },
    });

    if (!lead || lead.deletedAt) {
      return NextResponse.json({ message: 'Lead not found' }, { status: 404 });
    }

    // Find or create a deal for this lead
    let dealId: string;

    // 1. Check if lead already has a deal
    const existingDeal = await prisma.deal.findFirst({
      where: { leadId },
    });

    if (existingDeal) {
      dealId = existingDeal.id;
    } else {
      // 2. Need a customerId — use linkedCustomer or create a stub one
      let customerId: string;

      if (lead.linkedCustomer) {
        customerId = lead.linkedCustomer.id;
      } else {
        // Create a stub customer so we can attach a deal
        const stubCustomer = await prisma.customer.create({
          data: {
            companyName: lead.company,
            gstNumber: `PENDING-${Date.now()}`,
            industry: 'Other',
            customerCategory: 'PROSPECT',
          },
        });
        customerId = stubCustomer.id;

        // Link the lead to this stub customer
        await prisma.lead.update({
          where: { id: leadId },
          data: { linkedCustomerId: customerId },
        });
      }

      // 3. Create a stub deal linked to lead + customer
      const deal = await prisma.deal.create({
        data: {
          dealName: `${lead.name} - ${lead.company}`,
          dealValue: lead.quoteValue ?? 0,
          stage: 'SUSPECT',
          customerId,
          leadId,
          assignedToId: user.id,
        },
      });
      dealId = deal.id;
    }

    // 4. Create the follow-up
    const followUp = await prisma.followUp.create({
      data: {
        dealId,
        leadId,
        type,
        scheduledDate: new Date(scheduledDate),
        notes: notes || null,
        outcome: outcome || null,
        createdById: user.id,
      },
      select: {
        id: true,
        type: true,
        scheduledDate: true,
        outcome: true,
        notes: true,
      },
    });

    return NextResponse.json(followUp, { status: 201 });
  } catch (error: any) {
    console.error('Lead followup POST error:', error?.message, error?.code);
    return NextResponse.json({ message: error?.message || 'Internal server error' }, { status: 500 });
  }
});
