import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  hashSecret, safeEqualHex, generateTicket,
  MAX_ATTEMPTS, TICKET_TTL_MINUTES,
} from '@/lib/passwordReset';

// Step 2 of 3. Exchanges a correct code for a single-use ticket.
//
// Six digits is a million possibilities — small enough that the attempt cap
// below, not the code itself, is what makes this design safe. Everything here
// is built around not leaking free guesses.
const REJECT = 'That code is incorrect or has expired. Request a new one.';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const loginEmail = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const code = typeof body?.code === 'string' ? body.code.trim() : '';

  if (!loginEmail || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ message: REJECT }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: loginEmail },
    select: { id: true, isActive: true, deletedAt: true },
  });
  if (!user || !user.isActive || user.deletedAt) {
    return NextResponse.json({ message: REJECT }, { status: 400 });
  }

  const challenge = await prisma.passwordResetChallenge.findFirst({
    where: { userId: user.id, usedAt: null, verifiedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!challenge || challenge.expiresAt < new Date()) {
    return NextResponse.json({ message: REJECT }, { status: 400 });
  }

  // The counter is incremented BEFORE the comparison, and persisted, so a
  // guess always costs an attempt. Doing it afterwards would let an attacker
  // abandon each request mid-flight — or crash the process — and retry
  // indefinitely at zero cost, which quietly removes the only control
  // standing between a six-digit secret and exhaustive search.
  const attempted = await prisma.passwordResetChallenge.update({
    where: { id: challenge.id },
    data: { attempts: { increment: 1 } },
    select: { attempts: true, codeHash: true },
  });

  if (attempted.attempts > MAX_ATTEMPTS) {
    // Burn the challenge outright rather than merely refusing this guess, so
    // the remaining space can't be walked by starting fresh against the same
    // still-valid code.
    await prisma.passwordResetChallenge.update({
      where: { id: challenge.id },
      data: { usedAt: new Date() },
    });
    return NextResponse.json(
      { message: 'Too many incorrect attempts. Request a new code.', locked: true },
      { status: 429 }
    );
  }

  if (!safeEqualHex(attempted.codeHash, hashSecret(code))) {
    const remaining = Math.max(0, MAX_ATTEMPTS - attempted.attempts);
    return NextResponse.json(
      {
        message: remaining > 0
          ? `That code is incorrect. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Too many incorrect attempts. Request a new code.',
        attemptsRemaining: remaining,
      },
      { status: 400 }
    );
  }

  const { raw, hash } = generateTicket();
  await prisma.passwordResetChallenge.update({
    where: { id: challenge.id },
    data: {
      verifiedAt: new Date(),
      ticketHash: hash,
      ticketExpiresAt: new Date(Date.now() + TICKET_TTL_MINUTES * 60_000),
    },
  });

  // The code is now spent. The ticket — not the code — authorises step 3, so
  // a correct code observed in transit cannot be replayed to set a second
  // password after the legitimate user has finished.
  return NextResponse.json({ ticket: raw, expiresInMinutes: TICKET_TTL_MINUTES });
}
