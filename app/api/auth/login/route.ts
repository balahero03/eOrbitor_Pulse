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

    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
      return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
    }

    if (!user.isActive) {
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
