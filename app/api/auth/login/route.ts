import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, clearRateLimit, clientIp } from '@/lib/rateLimit';
import { prisma } from '@/lib/prisma';
import { istToday, istDateString } from '@/lib/istDate';
import bcrypt from 'bcryptjs';
import { signToken } from '@/lib/jwt';

// The working day in IST, not UTC. `toISOString()` gave the UTC date, so a
// login between midnight and 05:30 IST stamped the employee's attendance and
// TimeLog under the previous calendar day.
function todayStr() {
  return istToday();
}

// Generous enough that a person fumbling their password is unaffected, tight
// enough that guessing is impractical: 8 tries per 15 minutes, then a 15-minute
// lockout for that address-and-IP pair.
const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_WINDOW_MINUTES = 15;
const LOGIN_BLOCK_MINUTES = 15;

// A real bcrypt hash (of a value nobody can submit) compared against whenever
// no account matched, so an unknown address costs the same ~100ms as a known
// one. Without it `!user || await bcrypt.compare(...)` short-circuited: a
// missing account answered in a few milliseconds and a real one took as long
// as bcrypt does, which is a reliable oracle for testing whether an address is
// registered. /api/auth/forgot-password is careful to give nothing away —
// this route was undoing that.
// This is the hash of a random 32-byte value that was discarded, so no input
// can match it — deliberately not the hash of a real word.
const TIMING_DECOY_HASH = '$2a$10$xL6XctIzZJxQdgz4LSMFVuc53v6r0GF4XsDsSZvE3CmL.B54kj6vC';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ message: 'Email and password are required' }, { status: 400 });
    }

    // Throttle before doing any work. Sign-in was previously unlimited — ten
    // wrong passwords went through in under a second — so an attacker could
    // guess at the full speed of the server against a known address.
    //
    // Keyed on the submitted address *and* the caller's IP together, so
    // hammering someone else's email from one machine cannot lock that person
    // out of their own account from theirs.
    const throttleKey = `login:${String(email).trim().toLowerCase()}:${clientIp(req)}`;
    const verdict = rateLimit(throttleKey, {
      max: LOGIN_MAX_ATTEMPTS,
      windowMs: LOGIN_WINDOW_MINUTES * 60_000,
      blockMs: LOGIN_BLOCK_MINUTES * 60_000,
    });
    if (!verdict.allowed) {
      return NextResponse.json(
        {
          message: `Too many sign-in attempts. Try again in ${Math.ceil((verdict.retryAfterSeconds ?? 60) / 60)} minute(s).`,
          retryAfterSeconds: verdict.retryAfterSeconds,
        },
        { status: 429, headers: { 'Retry-After': String(verdict.retryAfterSeconds ?? 60) } }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Always spend the bcrypt cost, even with no account to check against.
    const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? TIMING_DECOY_HASH);
    if (!user || !passwordOk) {
      return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
    }

    // `deletedAt` is checked as well as `isActive`. withAuth already refuses a
    // token belonging to an ex-employee, so a soft-deleted account that had
    // been reactivated without being restored could sign in, receive a token,
    // and then be thrown out by the very next request — which reads as the app
    // being broken rather than as the account being closed.
    if (!user.isActive || user.deletedAt) {
      return NextResponse.json({ message: 'User account is inactive' }, { status: 403 });
    }

    // Correct password — the attempts were legitimate, so don't hold them
    // against a user who simply mistyped a few times before getting it right.
    clearRateLimit(throttleKey);

    const now = new Date();
    const dateStr = todayStr();

    // Auto-close any open TimeLog from a previous day
    const openLog = await prisma.timeLog.findFirst({
      where: { userId: user.id, logoutTime: null },
      orderBy: { loginTime: 'desc' },
    });

    if (openLog) {
      const openDate = istDateString(openLog.loginTime);
      if (openDate !== dateStr) {
        // Close the stale session so it doesn't stay open forever. This is
        // TimeLog cleanup only — it must NOT touch DailyActivity.logoutTime,
        // since the client wants that field set only by the employee
        // explicitly declaring their exit time, never guessed by the system.
        const midnight = new Date(openLog.loginTime);
        midnight.setHours(23, 59, 59, 0);
        const duration = Math.floor((midnight.getTime() - openLog.loginTime.getTime()) / 1000);

        await prisma.timeLog.update({
          where: { id: openLog.id },
          data: { logoutTime: midnight, sessionDuration: duration },
        });
      }
    }

    // Create new TimeLog for this login
    await prisma.timeLog.create({
      data: { userId: user.id, loginTime: now },
    });

    // Upsert today's DailyActivity — set loginTime only if this is the first login today
    const existing = await prisma.dailyActivity.findUnique({
      where: { userId_date: { userId: user.id, date: dateStr } },
    });

    if (!existing) {
      await prisma.dailyActivity.create({
        data: {
          userId: user.id,
          date: dateStr,
          activities: JSON.stringify([]),
          loginTime: now,
        },
      });
    }
    // If already exists, loginTime stays as the first login of the day — don't overwrite

    const token = signToken({ id: user.id, email: user.email, role: user.role });

    return NextResponse.json({
      token,
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'An error occurred' }, { status: 500 });
  }
}
