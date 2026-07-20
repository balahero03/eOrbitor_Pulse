// One-off data fix for the UserRole enum rename
// (SALES_MANAGER/SALES_EXEC/SUPPORT/VIEWER -> BACKEND_TEAM/ON_FIELD_TEAM).
// `prisma db push` cannot ALTER the enum type while rows still reference
// dropped variants, so this remaps them first. The new variants don't exist
// on the live enum yet either (schema.prisma has already moved on, but the
// DB hasn't), so we add them to the type before updating rows, then let
// `db push` drop the old variants afterwards.
// Safe to run every boot: ADD VALUE IF NOT EXISTS and the UPDATEs are
// no-ops once nothing matches, and it no-ops entirely on a fresh DB where
// the "User" table doesn't exist yet.
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'BACKEND_TEAM'`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ON_FIELD_TEAM'`);
  } catch (err) {
    console.log('[fix-user-role-enum] Skipped adding enum values:', err.message);
    await prisma.$disconnect();
    return;
  }

  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "User" SET role = 'BACKEND_TEAM' WHERE role::text IN ('SALES_MANAGER', 'SUPPORT')`
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "User" SET role = 'ON_FIELD_TEAM' WHERE role::text IN ('SALES_EXEC', 'VIEWER')`
    );
    console.log('[fix-user-role-enum] Legacy UserRole values remapped (if any existed).');
  } catch (err) {
    console.log('[fix-user-role-enum] Skipped remapping rows:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
