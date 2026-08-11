import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { validatePassword } from '@/lib/passwordPolicy';
import { revokeChallenges } from '@/lib/passwordReset';
import { sendMailAfterResponse, buildPasswordChangedEmail } from '@/lib/mail';

// Changing your own password while signed in — distinct from the "forgot"
// flow. Until now only an administrator could change any password at all,
// which meant a user who merely suspected their password was known had to
// file a request and wait.
//
// No emailed code here on purpose: proving knowledge of the current password
// while holding a live session is already strong evidence of identity, and
// adding a second factor to a routine action mostly trains people to click
// through prompts. The alert email below is what covers the case where that
// assumption is wrong.
export const POST = withAuth(async (req: NextRequest, auth: AuthUser) => {
  const body = await req.json().catch(() => ({}));
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ message: 'Enter your current and new password.' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.id },
    select: { id: true, email: true, firstName: true, passwordHash: true, personalEmail: true },
  });
  if (!user) return NextResponse.json({ message: 'User not found' }, { status: 404 });

  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return NextResponse.json({ message: 'Your current password is incorrect.' }, { status: 400 });
  }

  const verdict = validatePassword(newPassword, { email: user.email, firstName: user.firstName });
  if (!verdict.ok) {
    return NextResponse.json({ message: verdict.message }, { status: 400 });
  }
  if (currentPassword === newPassword) {
    return NextResponse.json({ message: 'Your new password must be different from the current one.' }, { status: 400 });
  }

  const now = new Date();
  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash, passwordChangedAt: now } }),
    prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'USER',
        entityId: user.id,
        changes: { passwordChanged: true, method: 'self-service' },
      },
    }),
  ]);
  await revokeChallenges(user.id);

  if (user.personalEmail) {
    sendMailAfterResponse('password-changed alert (self)', {
      to: user.personalEmail,
      subject: 'Your eOrbitor Pulse password was changed',
      html: buildPasswordChangedEmail({ firstName: user.firstName, when: now, method: 'self' }),
    });
  }

  // The caller's own token was issued before `passwordChangedAt` and is now
  // rejected by withAuth like any other. Flagged explicitly so the client can
  // send the user to the login screen rather than let them discover it as a
  // wall of failed requests.
  return NextResponse.json({
    message: 'Password changed. Please sign in again.',
    sessionEnded: true,
  });
});
