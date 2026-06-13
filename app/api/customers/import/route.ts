import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { ValidationError } from '@/lib/errors';

const CATEGORIES = ['PROSPECT', 'ACTIVE', 'INACTIVE', 'LOST'];

type RowInput = Record<string, string>;

type RowResult = {
  row: number;
  companyName?: string;
  status: 'created' | 'skipped' | 'error';
  message?: string;
};

// Bulk-create customers from parsed CSV rows.
// Body: { rows: Array<{ companyName, gstNumber, contactName, contactEmail, ... }> }
export const POST = withAuth(async (req: NextRequest, _user: AuthUser) => {
  const body = await req.json();
  const rows: RowInput[] = Array.isArray(body?.rows) ? body.rows : [];

  if (rows.length === 0) {
    throw new ValidationError('No rows to import');
  }
  if (rows.length > 1000) {
    throw new ValidationError('Too many rows — import at most 1000 at a time');
  }

  const results: RowResult[] = [];
  // Track GSTs seen within this batch to catch in-file duplicates.
  const seenGst = new Set<string>();
  let created = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2; // +1 for 0-index, +1 for header row
    const companyName = (r.companyName || '').trim();
    const gstNumber = (r.gstNumber || '').trim();
    const contactName = (r.contactName || '').trim();
    const contactEmail = (r.contactEmail || '').trim();
    const category = (r.customerCategory || 'ACTIVE').trim().toUpperCase();

    if (!companyName) {
      results.push({ row: rowNum, status: 'error', message: 'Company name is required' });
      continue;
    }
    if (!gstNumber) {
      results.push({ row: rowNum, companyName, status: 'error', message: 'GST number is required' });
      continue;
    }
    if (!contactName) {
      results.push({ row: rowNum, companyName, status: 'error', message: 'Contact name is required' });
      continue;
    }
    if (!contactEmail) {
      results.push({ row: rowNum, companyName, status: 'error', message: 'Contact email is required' });
      continue;
    }
    if (!CATEGORIES.includes(category)) {
      results.push({ row: rowNum, companyName, status: 'error', message: `Invalid category "${category}"` });
      continue;
    }
    if (seenGst.has(gstNumber)) {
      results.push({ row: rowNum, companyName, status: 'skipped', message: 'Duplicate GST within file' });
      continue;
    }

    const existing = await prisma.customer.findUnique({ where: { gstNumber } });
    if (existing) {
      results.push({ row: rowNum, companyName, status: 'skipped', message: 'GST already exists' });
      seenGst.add(gstNumber);
      continue;
    }

    const yearRaw = (r.yearEstablished || '').trim();
    const year = yearRaw ? parseInt(yearRaw, 10) : null;
    const revenue = (r.annualRevenue || '').trim();

    try {
      await prisma.customer.create({
        data: {
          companyName,
          gstNumber,
          industry: (r.industry || '').trim() || null,
          website: (r.website || '').trim() || null,
          annualRevenue: revenue ? revenue : null,
          yearEstablished: year && !Number.isNaN(year) ? year : null,
          customerCategory: category as any,
          billingAddress: (r.billingAddress || '').trim()
            ? { street: r.billingAddress.trim() }
            : undefined,
          shippingAddress: (r.shippingAddress || '').trim()
            ? { street: r.shippingAddress.trim() }
            : undefined,
          contacts: {
            create: {
              name: contactName,
              email: contactEmail,
              phone: (r.contactPhone || '').trim() || null,
              designation: (r.contactDesignation || '').trim() || null,
              isPrimary: true,
            },
          },
        },
      });
      seenGst.add(gstNumber);
      created++;
      results.push({ row: rowNum, companyName, status: 'created' });
    } catch (err: any) {
      results.push({ row: rowNum, companyName, status: 'error', message: err?.message || 'Failed to create' });
    }
  }

  const skipped = results.filter((r) => r.status === 'skipped').length;
  const errors = results.filter((r) => r.status === 'error').length;

  return NextResponse.json({
    summary: { total: rows.length, created, skipped, errors },
    results,
  });
});
