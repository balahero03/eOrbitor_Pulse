const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Clear existing data
  console.log('Clearing existing data...');
  await prisma.user.deleteMany({});

  // Create default admin user
  const hashedPassword = await bcrypt.hash('password', 10);

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@company.local',
      passwordHash: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      department: 'Management',
      isActive: true,
    },
  });

  console.log('Default admin user created:');
  console.log(`  Email: ${adminUser.email}`);
  console.log(`  Password: password`);
  console.log(`  Role: ${adminUser.role}`);

  // Create sample sales executive
  const salesUser = await prisma.user.create({
    data: {
      email: 'sales@company.local',
      passwordHash: hashedPassword,
      firstName: 'John',
      lastName: 'Sales',
      role: 'SALES_EXEC',
      department: 'Sales',
      assignedTerritory: 'North India',
      isActive: true,
    },
  });

  console.log('\nSample sales user created:');
  console.log(`  Email: ${salesUser.email}`);
  console.log(`  Password: password`);

  console.log('\n✅ Database seed completed successfully!');
  console.log('\nYou can now login with:');
  console.log('  Admin: admin@company.local / password');
  console.log('  Sales: sales@company.local / password');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
