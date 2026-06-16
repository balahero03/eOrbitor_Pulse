import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { NotFoundError, ValidationError } from '@/lib/errors';

const CATEGORIES = ['PROSPECT', 'ACTIVE', 'INACTIVE', 'LOST'];

export function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (_req: NextRequest, _user: AuthUser) => {
    const { id } = await ctx.params;

    const customer = await prisma.customer.findFirst({
      where: { id, deletedAt: null },
      include: {
        contacts: { orderBy: { isPrimary: 'desc' } },
        orders: { orderBy: { createdAt: 'desc' } },
        quotations: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!customer) throw new NotFoundError('Customer');

    return NextResponse.json(customer);
  })(req);
}

export function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(async (r: NextRequest, _user: AuthUser) => {
    const { id } = await ctx.params;
    const body = await r.json();

    const existing = await prisma.customer.findFirst({
      where: { id, deletedAt: null },
      include: { contacts: { orderBy: { isPrimary: 'desc' }, take: 1 } },
    });
    if (!existing) throw new NotFoundError('Customer');

    // companyName is intentionally not destructured — it is immutable after creation.
    const {
      gstNumber,
      industry,
      website,
      annualRevenue,
      yearEstablished,
      customerCategory,
      billingAddress,
      shippingAddress,
      contactName,
      contactEmail,
      contactPhone,
      contactDesignation,
    } = body;

    if (gstNumber !== undefined && !gstNumber.trim()) {
      throw new ValidationError('GST number cannot be empty');
    }
    if (customerCategory !== undefined && !CATEGORIES.includes(customerCategory)) {
      throw new ValidationError('Invalid customer category');
    }

    // GST is unique — guard against collisions with another customer.
    if (gstNumber !== undefined && gstNumber.trim() !== existing.gstNumber) {
      const clash = await prisma.customer.findUnique({ where: { gstNumber: gstNumber.trim() } });
      if (clash) throw new ValidationError('A customer with this GST number already exists');
    }

    const year = yearEstablished ? parseInt(yearEstablished, 10) : null;

    const data: any = {};
    if (gstNumber !== undefined) data.gstNumber = gstNumber.trim();
    if (industry !== undefined) data.industry = industry?.trim() || null;
    if (website !== undefined) data.website = website?.trim() || null;
    if (annualRevenue !== undefined) data.annualRevenue = annualRevenue ? annualRevenue.toString() : null;
    if (yearEstablished !== undefined) data.yearEstablished = year && !Number.isNaN(year) ? year : null;
    if (customerCategory !== undefined) data.customerCategory = customerCategory;
    if (billingAddress !== undefined) {
      data.billingAddress = billingAddress?.trim() ? { street: billingAddress.trim() } : undefined;
    }
    if (shippingAddress !== undefined) {
      data.shippingAddress = shippingAddress?.trim() ? { street: shippingAddress.trim() } : undefined;
    }

    await prisma.customer.update({ where: { id }, data });

    // Update the primary contact if any contact fields were provided.
    const contactProvided =
      contactName !== undefined ||
      contactEmail !== undefined ||
      contactPhone !== undefined ||
      contactDesignation !== undefined;

    if (contactProvided) {
      const primary = existing.contacts[0];
      const contactData: any = {};
      if (contactName !== undefined) contactData.name = contactName.trim();
      if (contactEmail !== undefined) contactData.email = contactEmail.trim();
      if (contactPhone !== undefined) contactData.phone = contactPhone?.trim() || null;
      if (contactDesignation !== undefined) contactData.designation = contactDesignation?.trim() || null;

      if (primary) {
        await prisma.contact.update({ where: { id: primary.id }, data: contactData });
      } else if (contactData.name && contactData.email) {
        await prisma.contact.create({
          data: { ...contactData, customerId: id, isPrimary: true },
        });
      }
    }

    const updated = await prisma.customer.findUnique({
      where: { id },
      include: { contacts: { orderBy: { isPrimary: 'desc' } } },
    });

    return NextResponse.json(updated);
  })(req);
}
