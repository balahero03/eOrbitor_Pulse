import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateToken } from '@/lib/tokens';
import { generateCode, hashSecret } from '@/lib/passwordReset';
import { sendMail, buildEmailVerificationEmail, MailResult } from '@/lib/mail';
import { getAppBaseUrl } from '@/lib/appUrl';

// Two hours rather than one. The link is opened from a mailbox, often on a
// different device and not always immediately — an hour was short enough that
// a message read the same evening could already be dead, which is the
// "Verification Failed" screen users kept hitting.
export const EMAIL_VERIFICATION_TTL_MINUTES = 120;

// Guessing budget for the typed code. Six digits is a million possibilities,
// so this cap is the whole reason a short code is as safe as the 32-byte
// token — see the identical control on PasswordResetChallenge.
export const MAX_CODE_ATTEMPTS = 5;

export interface IssueResult {
  delivery: MailResult;
  /** The 6-digit code, for the same dev-only fallback as `verifyUrl`. */
  code: string;
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
  // A typed code alongside the link. A link is one string that has to survive
  // an inbox, a mail scanner that may pre-fetch and spend it, a webmail
  // redirect wrapper and a mobile client's in-app browser; when any of those
  // mangles it the user has nothing left to try. Six digits they can read off
  // the screen and type is a second, independent path to the same proof —
  // which is what "verification keeps failing" actually needed.
  const code = generateCode();
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MINUTES * 60 * 1000);

  // Supersede any earlier outstanding link for this account so only the
  // newest email in the inbox works.
  await prisma.emailVerificationToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      email: user.personalEmail,
      tokenHash: hash,
      // Hashed, never stored raw — a database read alone must not be
      // replayable into a confirmed address.
      codeHash: hashSecret(code),
      expiresAt,
    },
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
      code,
      expiresInMinutes: EMAIL_VERIFICATION_TTL_MINUTES,
    }),
  });

  return { delivery, verifyUrl, code };
}

// Guard for the dev-only fallback described on IssueResult.verifyUrl.
export function mayExposeVerifyUrl(): boolean {
  return process.env.NODE_ENV !== 'production';
}
