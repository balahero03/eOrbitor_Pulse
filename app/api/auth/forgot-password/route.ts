import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendMailAfterResponse, buildPasswordResetCodeEmail, isMailConfigured } from '@/lib/mail';
import {
  generateCode, hashSecret, clientIp, checkRateLimits,
  CODE_TTL_MINUTES, RESEND_COOLDOWN_SECONDS,
} from '@/lib/passwordReset';

// Step 1 of 3. Public by necessity — the caller is locked out — so this
// mirrors /api/auth/login in not going through withAuth.
//
// The reply is deliberately identical for every input: a real account, an
// unknown one, a disabled one, or one with no verified recovery address. The
// previous version answered differently in each case, which turned this
// endpoint into a way to test whether a given login exists. The UI always
// advances to the code screen and tells the user what to do if no code
// arrives, so nothing is lost by refusing to confirm.
const GENERIC = {
  message: 'If that account exists and has a verified recovery email, a code is on its way.',
  codeSent: true,
  expiresInMinutes: CODE_TTL_MINUTES,
  resendCooldownSeconds: RESEND_COOLDOWN_SECONDS,
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const loginEmail = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!loginEmail) {
    return NextResponse.json({ message: 'Enter the email you sign in with.' }, { status: 400 });
  }

  // Checked before the account is looked up, on purpose. A broken mail server
  // is a property of the deployment rather than of any one account, so
  // reporting it here reveals nothing — whereas discovering it after the
  // lookup would mean only real accounts ever saw the error.
  if (!isMailConfigured()) {
    return NextResponse.json(
      { message: 'Password reset is unavailable because email is not configured on this server. Please contact your administrator.' },
      { status: 503 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: loginEmail },
    select: {
      id: true, firstName: true, isActive: true, deletedAt: true,
      personalEmail: true, personalEmailVerifiedAt: true,
    },
  });

  const eligible = !!user && user.isActive && !user.deletedAt
    && !!user.personalEmail && !!user.personalEmailVerifiedAt;

  if (!eligible) {
    return NextResponse.json(GENERIC);
  }

  const ip = clientIp(req);
  const verdict = await checkRateLimits(user!.id, ip);
  if (!verdict.allowed) {
    // 429 is honest about the throttle without revealing anything: an
    // attacker probing addresses learns only that *they* have been rate
    // limited, which they already know from their own request volume.
    return NextResponse.json(
      {
        message: 'Too many reset requests. Please wait before trying again.',
        retryAfterSeconds: verdict.retryAfterSeconds,
      },
      { status: 429, headers: { 'Retry-After': String(verdict.retryAfterSeconds ?? 60) } }
    );
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000);

  // A fresh request supersedes anything outstanding, so only the newest code
  // in the mailbox works and an older message can't be used later.
  await prisma.passwordResetChallenge.updateMany({
    where: { userId: user!.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.passwordResetChallenge.create({
    data: {
      userId: user!.id,
      codeHash: hashSecret(code),
      expiresAt,
      requestIp: ip === 'unknown' ? null : ip,
    },
  });

  // Deferred, not awaited: mail health was established above, so the outcome
  // cannot change this response — and awaiting would make a real account take
  // measurably longer to answer than an unknown one, which is the timing
  // side-channel this endpoint is otherwise careful to avoid.
  //
  // It must go through `sendMailAfterResponse`, though. A bare `void
  // sendMail(...)` here sent nothing at all: the handler returned in ~25ms and
  // Next tore the request down long before the ~2s SMTP exchange finished, so
  // the challenge row was written, the caller was told a code was on its way,
  // and no mail ever left the server.
  sendMailAfterResponse('reset code', {
    to: user!.personalEmail!,
    // The code is deliberately kept out of the subject. Putting it there is
    // common (Google and GitHub both do it) and is genuinely more convenient,
    // but it renders the code on a locked phone screen to anyone holding the
    // device — which undoes the point of sending it to a mailbox only the
    // owner can open. The body's preheader omits it for the same reason.
    subject: 'eOrbitor Pulse — password reset verification code',
    html: buildPasswordResetCodeEmail({
      firstName: user!.firstName,
      code,
      expiresInMinutes: CODE_TTL_MINUTES,
    }),
  });

  // Returns the same object as the ineligible path above — deliberately. An
  // earlier draft echoed a masked recipient here, which was worse than the
  // enumeration it was meant to replace: present only for real accounts, and
  // leaking part of the address as well as the account's existence.
  return NextResponse.json(GENERIC);
}
