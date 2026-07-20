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
  } finally {
    await prisma.$disconnect();
  }
}

main();
