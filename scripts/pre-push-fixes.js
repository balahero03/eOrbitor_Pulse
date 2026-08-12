// Runs before `prisma db push` to work around two issues `db push` can't
// handle on its own against a live DB with existing data:
//
// 1. UserRole enum rename (SALES_MANAGER/SALES_EXEC/SUPPORT/VIEWER ->
//    BACKEND_TEAM/ON_FIELD_TEAM). `db push` cannot ALTER the enum type
//    while rows still reference dropped variants, and the new variants
//    don't exist on the live enum yet either — add them, remap rows, then
//    let `db push` drop the old variants.
//
// 2. AccessPolicy/QuotationPolicy/AfterHoursAccessRequest are new tables
//    added in the same schema change as the enum rename. When `db push`
//    has to both ALTER the enum and CREATE a table with a column of that
//    enum type (AccessPolicy.restrictedRoles UserRole[]) in one pass, the
//    Prisma 5 schema engine errors with P1014 ("underlying table does not
//    exist") — an ordering bug in how it batches AlterEnum + CreateTable.
//    Pre-creating these tables here sidesteps the batching entirely; by
//    the time `db push` runs they already exist and it's a no-op for them.
//
// Safe to run every boot: everything is IF NOT EXISTS / no-op once applied,
// and each step is wrapped so a fresh DB (nothing exists yet) just skips
// straight through without erroring.
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();

  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'BACKEND_TEAM'`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ON_FIELD_TEAM'`);

    await prisma.$executeRawUnsafe(
      `UPDATE "User" SET role = 'BACKEND_TEAM' WHERE role::text IN ('SALES_MANAGER', 'SUPPORT')`
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "User" SET role = 'ON_FIELD_TEAM' WHERE role::text IN ('SALES_EXEC', 'VIEWER')`
    );
    console.log('[pre-push-fixes] UserRole enum remapped (if any legacy rows existed).');
  } catch (err) {
    console.log('[pre-push-fixes] UserRole remap skipped:', err.message);
  }

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AccessPolicy" (
        "id" TEXT NOT NULL DEFAULT 'singleton',
        "enabled" BOOLEAN NOT NULL DEFAULT false,
        "restrictedRoles" "UserRole"[] NOT NULL DEFAULT ARRAY[]::"UserRole"[],
        "windowStart" TEXT NOT NULL DEFAULT '21:00',
        "windowEnd" TEXT NOT NULL DEFAULT '08:00',
        "forceCutoff" BOOLEAN NOT NULL DEFAULT false,
        "updatedBy" TEXT,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AccessPolicy_pkey" PRIMARY KEY ("id")
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "QuotationPolicy" (
        "id" TEXT NOT NULL DEFAULT 'singleton',
        "restrictionsDisabled" BOOLEAN NOT NULL DEFAULT false,
        "updatedBy" TEXT,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "QuotationPolicy_pkey" PRIMARY KEY ("id")
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AfterHoursAccessRequest" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "date" TEXT NOT NULL,
        "reason" TEXT NOT NULL,
        "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
        "reviewedBy" TEXT,
        "reviewedAt" TIMESTAMP(3),
        "rejectionReason" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AfterHoursAccessRequest_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "AfterHoursAccessRequest_userId_idx" ON "AfterHoursAccessRequest"("userId")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "AfterHoursAccessRequest_status_idx" ON "AfterHoursAccessRequest"("status")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "AfterHoursAccessRequest_userId_date_idx" ON "AfterHoursAccessRequest"("userId", "date")`
    );
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "AfterHoursAccessRequest"
          ADD CONSTRAINT "AfterHoursAccessRequest_userId_fkey"
          FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    console.log('[pre-push-fixes] AccessPolicy/QuotationPolicy/AfterHoursAccessRequest tables ensured.');
  } catch (err) {
    console.log('[pre-push-fixes] Table pre-creation skipped:', err.message);
  }

  // 3. Lead.leadNumber backfill.
  //
  //    Lead numbers used to live in `quoteNo`, a free-text column that also
  //    held imported spreadsheet S.NO values and customers' own quote
  //    references. With no unique constraint and a generator that ordered
  //    lexicographically, live data ended up with many leads sharing one
  //    number and others showing a "QT-…" quotation number instead.
  //
  //    This creates the column and index up front (so `db push` finds them
  //    already in place and cannot fail adding a UNIQUE index to a column
  //    that still contains duplicates), then issues one number per lead in
  //    creation order.
  //
  //    Idempotent: only rows where leadNumber IS NULL are touched, so a
  //    second boot is a no-op and numbers already handed out never move.
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "leadNumber" TEXT`);

    // Anything already carrying a well-formed, unique LD-…-… in quoteNo keeps
    // it, so existing printed/quoted references stay valid.
    await prisma.$executeRawUnsafe(`
      UPDATE "Lead" l SET "leadNumber" = l."quoteNo"
      WHERE l."leadNumber" IS NULL
        AND l."quoteNo" ~ '^LD-[0-9]{4}-[0-9]+$'
        AND (SELECT count(*) FROM "Lead" d WHERE d."quoteNo" = l."quoteNo") = 1
    `);

    // Everyone else — duplicates, QT-prefixed values, blanks — gets a fresh
    // number continuing after the highest already in use. row_number() makes
    // the assignment deterministic and collision-free in a single statement.
    await prisma.$executeRawUnsafe(`
      WITH start AS (
        SELECT COALESCE(MAX((regexp_match("leadNumber", '^LD-[0-9]{4}-([0-9]+)$'))[1]::int), 0) AS n
        FROM "Lead" WHERE "leadNumber" IS NOT NULL
      ),
      queued AS (
        SELECT id, row_number() OVER (ORDER BY "createdAt", id) AS rn
        FROM "Lead" WHERE "leadNumber" IS NULL
      )
      UPDATE "Lead" l
      SET "leadNumber" = 'LD-' || to_char(COALESCE(l."createdAt", now()), 'YYYY')
                              || '-' || lpad((start.n + queued.rn)::text, 4, '0')
      FROM queued, start
      WHERE l.id = queued.id
    `);

    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "Lead_leadNumber_key" ON "Lead"("leadNumber")`
    );

    const [{ count }] = await prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS count FROM "Lead" WHERE "leadNumber" IS NOT NULL`
    );
    console.log(`[pre-push-fixes] Lead.leadNumber backfilled — ${count} leads numbered, unique index ensured.`);
  } catch (err) {
    // A failure here must not block the deploy; the column is additive and the
    // app falls back to quoteNo for display.
    console.log('[pre-push-fixes] leadNumber backfill skipped:', err.message);
  }

  await prisma.$disconnect();
}

main();
