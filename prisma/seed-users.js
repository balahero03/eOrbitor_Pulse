const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('eOrbitor@2024', 10);

  // 1. Admin
  const admin = await prisma.user.upsert({
    where: { email: 'vaidyanathan.cr@eorbitor.com' },
    update: { role: 'ADMIN', isActive: true, passwordHash: hash },
    create: {
      email: 'vaidyanathan.cr@eorbitor.com',
      passwordHash: hash,
      firstName: 'Vaidyanathan',
      lastName: 'C R',
      role: 'ADMIN',
      department: 'Management',
      isActive: true,
    },
  });
  console.log(`Admin: ${admin.email}`);

  // 2. Manager / Backend Team
  const manager = await prisma.user.upsert({
    where: { email: 'elizabeth.g@eorbitor.com' },
    update: { role: 'BACKEND_TEAM', isActive: true, passwordHash: hash },
    create: {
      email: 'elizabeth.g@eorbitor.com',
      passwordHash: hash,
      firstName: 'Elizabeth',
      lastName: 'Geetha',
      role: 'BACKEND_TEAM',
      department: 'Sales',
      isActive: true,
    },
  });
  console.log(`Manager (Backend Team): ${manager.email}`);

  // 3. Salespersons (On Field Team) — all report to the manager
  const salespersons = [
    { email: 'sales@eorbitor.com',      firstName: 'Hema Priya', lastName: 'B' },
    { email: 'jeevitha.r@eorbitor.com', firstName: 'Jeevitha',   lastName: 'R' },
  ];

  for (const sp of salespersons) {
    const user = await prisma.user.upsert({
      where: { email: sp.email },
      update: { role: 'ON_FIELD_TEAM', isActive: true, passwordHash: hash, managerId: manager.id },
      create: {
        email: sp.email,
        passwordHash: hash,
        firstName: sp.firstName,
        lastName: sp.lastName,
        role: 'ON_FIELD_TEAM',
        department: 'Sales',
        managerId: manager.id,
        isActive: true,
      },
    });
    console.log(`Field Representative: ${user.email} → reports to ${manager.firstName}`);
  }

  console.log('\nAll users seeded. Default password: eOrbitor@2024');
  console.log('Roles:');
  console.log('  ADMIN        → vaidyanathan.cr@eorbitor.com  (sees everything)');
  console.log('  BACKEND_TEAM → elizabeth.g@eorbitor.com       (sees own team leads)');
  console.log('  ON_FIELD_TEAM→ sales@eorbitor.com             (sees own leads only)');
  console.log('  ON_FIELD_TEAM→ jeevitha.r@eorbitor.com        (sees own leads only)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
