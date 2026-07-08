import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { checkAccessGate } from '@/lib/accessControl';

export const GET = withAuth(async (_req: NextRequest, user: AuthUser) => {
  const gate = await checkAccessGate(user.role, user.id);
  return NextResponse.json(gate);
});
