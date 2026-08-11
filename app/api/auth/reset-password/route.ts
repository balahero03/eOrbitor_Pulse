import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { hashSecret } from '@/lib/passwordReset';
import { validatePassword } from '@/lib/passwordPolicy';
import { sendMailAfterResponse, buildPasswordChangedEmail } from '@/lib/mail';

// Step 3 of 3. Consumes the ticket issued by /verify-reset-code and writes the
// new password.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const ticket = typeof body?.ticket === 'string' ? body.ticket.trim() : '';
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

  if (!ticket || !newPassword) {
    return NextResponse.json({ message: 'Missing reset ticket or password.' }, { status: 400 });
  }

  const challenge = await prisma.passwordResetChallenge.findUnique({
    where: { ticketHash: hashSecret(ticket) },
    include: {
      user: { select: { id: true, email: true, firstName: true, isActive: true, deletedAt: true, personalEmail: true, passwordHash: true } },
    },
  });

  const ticketValid = challenge
    && !challenge.usedAt
    && challenge.verifiedAt
    && challenge.ticketExpiresAt
    && challenge.ticketExpiresAt > new Date();

  if (!ticketValid) {
    return NextResponse.json(
      { message: 'This reset session has expired. Please start again.', restart: true },
      { status: 400 }
    );
  }
  const user = challenge!.user;
  if (!user.isActive || user.deletedAt) {
    return NextResponse.json({ message: 'This account is no longer active.' }, { status: 400 });
  }

  const verdict = validatePassword(newPassword, { email: user.email, firstName: user.firstName });
  if (!verdict.ok) {
    // Deliberately does NOT consume the ticket — a rejected password is the
    // user's own typo, and forcing them back through email for it would be
    // hostile. The ticket's own short expiry still bounds the window.
    return NextResponse.json({ message: verdict.message }, { status: 400 });
  }

  // Reusing the current password would leave a known-compromised credential
  // in place while giving the user the impression they had changed it.
  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    return NextResponse.json(
      { message: 'That is already your current password. Choose a different one.' },
      { status: 400 }
    );
  }

  const now = new Date();
  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction([
    // passwordChangedAt is what actually revokes every outstanding session —
    // see the check in lib/middleware/auth.ts. Writing it in the same
    // transaction as the hash means there is no instant where the new
    // password is live but old tokens still are.
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordChangedAt: now },
    }),
    prisma.passwordResetChallenge.update({
      where: { id: challenge!.id },
      data: { usedAt: now },
    }),
    prisma.passwordResetChallenge.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now },
    }),
    prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'USER',
        entityId: user.id,
        changes: { passwordReset: true, method: 'emailed-code' },
      },
    }),
  ]);

  if (user.personalEmail) {
    sendMailAfterResponse('password-changed alert (reset)', {
      to: user.personalEmail,
      subject: 'Your eOrbitor Pulse password was changed',
      html: buildPasswordChangedEmail({ firstName: user.firstName, when: now, method: 'reset' }),
    });
  }

  return NextResponse.json({
    message: 'Your password has been changed. Please sign in with your new password.',
  });
}
