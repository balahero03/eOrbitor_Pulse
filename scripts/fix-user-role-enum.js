// One-off data fix for the UserRole enum rename
// (SALES_MANAGER/SALES_EXEC/SUPPORT/VIEWER -> BACKEND_TEAM/ON_FIELD_TEAM).
// `prisma db push` cannot ALTER the enum type while rows still reference
// dropped variants, so this remaps them first. Safe to run every boot: the
// UPDATEs are no-ops once no rows match, and it no-ops entirely on a fresh
// DB where the "User" table doesn't exist yet.
const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "User" SET role = 'BACKEND_TEAM' WHERE role::text IN ('SALES_MANAGER', 'SUPPORT')`
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "User" SET role = 'ON_FIELD_TEAM' WHERE role::text IN ('SALES_EXEC', 'VIEWER')`
    );
    console.log('[fix-user-role-enum] Legacy UserRole values remapped (if any existed).');
  } catch (err) {
    console.log('[fix-user-role-enum] Skipped:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
