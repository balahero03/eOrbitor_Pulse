import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateToken } from '@/lib/tokens';
import { sendMail, buildEmailVerificationEmail, MailResult } from '@/lib/mail';
import { getAppBaseUrl } from '@/lib/appUrl';

export const EMAIL_VERIFICATION_TTL_MINUTES = 60;

export interface IssueResult {
  delivery: MailResult;
  /**
   * The raw verification link. Returned so a NON-production caller can show
   * it in the UI when SMTP is unavailable, making the flow testable without a
   * mail server. It must never be exposed in production: the entire point of
   * email verification is proving control of the mailbox, and handing the
   * link to the browser that requested it proves nothing — anyone could then
   * "verify" an address they don't own.
   */
  verifyUrl: string;
}

// Shared by the auto-send-on-change in PATCH /api/profile and the manual
// "Resend verification email" button — both need the exact same token +
// email plumbing.
export async function issueEmailVerification(
  user: { id: string; firstName: string; personalEmail: string },
  req?: NextRequest
): Promise<IssueResult> {
  const { raw, hash } = generateToken();
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MINUTES * 60 * 1000);

  // Supersede any earlier outstanding link for this account so only the
  // newest email in the inbox works.
  await prisma.emailVerificationToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.emailVerificationToken.create({
    data: { userId: user.id, email: user.personalEmail, tokenHash: hash, expiresAt },
  });

  const verifyUrl = `${getAppBaseUrl(req)}/verify-email?token=${raw}`;

  // Awaited (not fire-and-forget): the caller reports the true outcome to the
  // user, and telling someone to "check your inbox" for mail that failed to
  // send is worse than a moment's wait. The transport carries short timeouts
  // (see lib/mail.ts) so an unreachable host fails fast rather than hanging.
  const delivery = await sendMail({
    to: user.personalEmail,
    subject: 'eOrbitor Pulse — confirm your recovery email address',
    html: buildEmailVerificationEmail({
      firstName: user.firstName,
      verifyUrl,
      expiresInMinutes: EMAIL_VERIFICATION_TTL_MINUTES,
    }),
  });

  return { delivery, verifyUrl };
}

// Guard for the dev-only fallback described on IssueResult.verifyUrl.
export function mayExposeVerifyUrl(): boolean {
  return process.env.NODE_ENV !== 'production';
}
