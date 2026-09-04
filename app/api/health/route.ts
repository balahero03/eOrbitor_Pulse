import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Deliberately outside withAuth — an uptime monitor has no JWT to send.
// Pings the DB rather than just returning 200 for the process being up, since
// "the Next.js process is alive but Postgres is unreachable" is exactly the
// failure mode a liveness probe exists to catch.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', db: 'up', time: new Date().toISOString() });
  } catch (err) {
    console.error('[health] DB check failed:', err);
    return NextResponse.json(
      { status: 'error', db: 'down', time: new Date().toISOString() },
      { status: 503 }
    );
  }
}
