import { prisma } from '@/lib/prisma';

const IST_TZ = 'Asia/Kolkata';

// Hard safety rail — independent of whatever roles an admin configures on the
// policy, SUPER_ADMIN/ADMIN can never be gated. Prevents an admin locking out
// every admin (including themselves) by misconfiguring restrictedRoles.
const HARD_EXEMPT_ROLES = ['SUPER_ADMIN', 'ADMIN'];

// API paths a *blocked* user must still be able to reach: checking their own
// status, filing/viewing their own access request, notifications, and
// logging out. Everything else gets the gate applied.
const EXEMPT_PATHS = [
  '/api/auth/login',
  '/api/auth/me',
  '/api/access-status',
  '/api/access-requests',
  '/api/notifications',
  '/api/time-tracking',
  '/api/cron/inactive-users',
];

export function isExemptPath(pathname: string): boolean {
  return EXEMPT_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function nowInIST(): { dateStr: string; hm: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { dateStr: `${get('year')}-${get('month')}-${get('day')}`, hm: `${get('hour')}:${get('minute')}` };
}

function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

// IST is a fixed UTC+5:30 offset (no DST) — safe to hardcode.
function istWallClockToInstant(dateStr: string, hm: string): Date {
  return new Date(`${dateStr}T${hm}:00+05:30`);
}

function isWithinWindow(hm: string, start: string, end: string): boolean {
  if (start === end) return false; // zero-length window never active
  return start < end ? hm >= start && hm < end : hm >= start || hm < end; // wraps midnight if start > end
}

// Which "night" (request date key) does the current restricted instant belong
// to? Returns null if we're not currently inside the window at all.
export function currentNightDate(windowStart: string, windowEnd: string): string | null {
  const { dateStr, hm } = nowInIST();
  if (!isWithinWindow(hm, windowStart, windowEnd)) return null;
  return hm >= windowStart ? dateStr : shiftDate(dateStr, -1); // tail end of yesterday's wrapped window
}

export type AccessGateResult =
  | { blocked: false }
  | { blocked: true; date: string; windowStart: string; windowEnd: string };

export async function checkAccessGate(userRole: string, userId: string): Promise<AccessGateResult> {
  if (HARD_EXEMPT_ROLES.includes(userRole)) return { blocked: false };

  const policy = await prisma.accessPolicy.findUnique({ where: { id: 'singleton' } });
  if (!policy || !policy.enabled) return { blocked: false };
  if (!policy.restrictedRoles.includes(userRole as any)) return { blocked: false };

  const nightDate = currentNightDate(policy.windowStart, policy.windowEnd);
  if (!nightDate) return { blocked: false };

  if (!policy.forceCutoff) {
    const openSession = await prisma.timeLog.findFirst({
      where: { userId, logoutTime: null },
      orderBy: { loginTime: 'desc' },
    });
    if (openSession) {
      const windowStartInstant = istWallClockToInstant(nightDate, policy.windowStart);
      if (openSession.loginTime.getTime() < windowStartInstant.getTime()) {
        return { blocked: false }; // grandfathered — session predates tonight's window
      }
    }
  }

  const approved = await prisma.afterHoursAccessRequest.findFirst({
    where: { userId, date: nightDate, status: 'APPROVED' },
  });
  if (approved) return { blocked: false };

  return { blocked: true, date: nightDate, windowStart: policy.windowStart, windowEnd: policy.windowEnd };
}
