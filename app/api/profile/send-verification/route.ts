import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { issueEmailVerification, mayExposeVerifyUrl } from '@/lib/emailVerification';

// "Resend verification email" — same token/email plumbing the auto-send in
// PATCH /api/profile uses, exposed on its own for when the first link
// expired or never arrived.
export const POST = withAuth(async (req: NextRequest, auth: AuthUser) => {
  const user = await prisma.user.findUnique({
    where: { id: auth.id },
    select: { firstName: true, personalEmail: true, personalEmailVerifiedAt: true },
  });
  if (!user) return NextResponse.json({ message: 'User not found' }, { status: 404 });
  if (!user.personalEmail) {
    return NextResponse.json({ message: 'Add a recovery email to your profile first' }, { status: 400 });
  }
  if (user.personalEmailVerifiedAt) {
    return NextResponse.json({ message: 'This email is already verified' }, { status: 400 });
  }

  const { delivery, verifyUrl } = await issueEmailVerification(
    { id: auth.id, firstName: user.firstName, personalEmail: user.personalEmail },
    req
  );

  return NextResponse.json({
    message: delivery.ok
      ? 'Verification email sent'
      : "We couldn't send the email — the mail server is unreachable.",
    emailSent: delivery.ok,
    mailProblem: delivery.ok ? undefined : delivery.reason,
    verifyUrl: !delivery.ok && mayExposeVerifyUrl() ? verifyUrl : undefined,
  });
});
