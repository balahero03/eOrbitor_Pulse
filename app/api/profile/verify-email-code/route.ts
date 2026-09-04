import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { hashSecret, safeEqualHex } from '@/lib/passwordReset';
import { MAX_CODE_ATTEMPTS } from '@/lib/emailVerification';

// The typed alternative to the emailed link.
//
// Behind `withAuth` on purpose, where the link route is public. The link has
// to work on a device with no session — it is opened straight from a mailbox
// — so its token has to stand alone as the credential. A code does not need
// that: the person typing it is on their own Profile page, already signed in.
// Taking the account from the session instead of an `email` field in the body
// means there is no address to guess against and no way to probe whether one
// exists, which the reset-code flow has to accept but this does not.
//
// Six digits is a million possibilities, so the attempt cap is what makes a
// short code as safe as the 32-byte token — same control, same reasoning as
// PasswordResetChallenge.
const REJECT = 'That code is incorrect or has expired. Request a new one from your Profile.';

export const POST = withAuth(async (req: NextRequest, auth: AuthUser) => {
  const body = await req.json().catch(() => ({}));
  // Spaces stripped so the grouped "481 920" shown in the email can be typed
  // or pasted back exactly as it appears.
  const code = typeof body?.code === 'string' ? body.code.replace(/\s+/g, '') : '';

  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ message: REJECT }, { status: 400 });
  }

  const record = await prisma.emailVerificationToken.findFirst({
    where: { userId: auth.id, usedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!record || !record.codeHash || record.expiresAt < new Date()) {
    return NextResponse.json({ message: REJECT }, { status: 400 });
  }

  // The address may have changed again since this code was sent. Confirming
  // would otherwise stamp the *current* address as verified on the strength of
  // a code that was mailed to a different one.
  const user = await prisma.user.findUnique({
    where: { id: auth.id },
    select: { personalEmail: true },
  });
  if (!user || user.personalEmail !== record.email) {
    return NextResponse.json(
      { message: 'This code is for an email address that is no longer on your account. Please request a new one.' },
      { status: 400 }
    );
  }

  // Incremented and persisted BEFORE the comparison, so a guess always costs an
  // attempt. The other order lets a caller abandon the request mid-flight and
  // retry at zero cost, which removes the only control standing between six
  // digits and exhaustive search.
  const attempted = await prisma.emailVerificationToken.update({
    where: { id: record.id },
    data: { attempts: { increment: 1 } },
    select: { attempts: true, codeHash: true },
  });

  if (attempted.attempts > MAX_CODE_ATTEMPTS) {
    // Burn the record rather than just refusing this guess — otherwise the
    // remaining space can be walked by starting over against a still-valid code.
    await prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    return NextResponse.json(
      { message: 'Too many incorrect attempts. Request a new code from your Profile.', locked: true },
      { status: 429 }
    );
  }

  if (!safeEqualHex(attempted.codeHash ?? '', hashSecret(code))) {
    const remaining = Math.max(0, MAX_CODE_ATTEMPTS - attempted.attempts);
    return NextResponse.json(
      {
        message: remaining > 0
          ? `That code is incorrect. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Too many incorrect attempts. Request a new code from your Profile.',
        attemptsRemaining: remaining,
      },
      { status: 400 }
    );
  }

  // Both the code and its sibling link are spent together: they are two routes
  // to the same single proof, so confirming by one must not leave the other
  // live in an inbox.
  await prisma.$transaction([
    prisma.user.update({ where: { id: auth.id }, data: { personalEmailVerifiedAt: new Date() } }),
    prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);

  return NextResponse.json({ message: 'Your email has been verified.' });
});
