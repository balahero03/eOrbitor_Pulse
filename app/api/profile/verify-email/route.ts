import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashToken } from '@/lib/tokens';

// Public — reached by clicking the emailed link, which may well be on a
// device with no active session, so this mirrors /api/auth/reset-password in
// not going through withAuth. The token itself (tied to a userId at issue
// time) is the credential.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = typeof body?.token === 'string' ? body.token : '';
  if (!token) return NextResponse.json({ message: 'Token is required' }, { status: 400 });

  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, personalEmail: true } } },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.json(
      { message: 'This verification link is invalid or has expired. Please request a new one from your Profile.' },
      { status: 400 }
    );
  }
  // The address may have been changed again since this link was sent — only
  // confirm it if it's still the one on the account.
  if (record.user.personalEmail !== record.email) {
    return NextResponse.json(
      { message: 'This link is for an email address that is no longer on your account. Please request a new verification link.' },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { personalEmailVerifiedAt: new Date() } }),
    prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);

  return NextResponse.json({ message: 'Your email has been verified.' });
}
