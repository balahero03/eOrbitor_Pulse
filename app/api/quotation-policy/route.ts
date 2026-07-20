import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, requireRoles, AuthUser } from '@/lib/middleware/auth';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

async function getOrCreatePolicy() {
  return prisma.quotationPolicy.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });
}

// Any authenticated user can read the flag — the frontend needs it to decide
// whether to show the "+ New Quotation" action for non-owners.
export const GET = withAuth(async (_req: NextRequest, _user: AuthUser) => {
  const policy = await getOrCreatePolicy();
  return NextResponse.json(policy);
});

export const PATCH = withAuth(
  requireRoles(ADMIN_ROLES)(async (req: NextRequest, user: AuthUser) => {
    const { restrictionsDisabled } = await req.json();
    if (typeof restrictionsDisabled !== 'boolean') {
      return NextResponse.json({ message: 'restrictionsDisabled must be a boolean' }, { status: 400 });
    }

    const policy = await prisma.quotationPolicy.upsert({
      where: { id: 'singleton' },
      update: { restrictionsDisabled, updatedBy: user.id },
      create: { id: 'singleton', restrictionsDisabled, updatedBy: user.id },
    });

    return NextResponse.json(policy);
  })
);
