const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');
  console.log('Clearing all data...');

  // Delete in dependency order so FK constraints are not violated
  await prisma.scheduledReport.deleteMany({});
  await prisma.report.deleteMany({});
  await prisma.activityUnlockRequest.deleteMany({});
  await prisma.timeLog.deleteMany({});
  await prisma.dailyActivity.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.activityLog.deleteMany({});
  await prisma.approvalRequest.deleteMany({});
  await prisma.announcement.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.followUp.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.quotation.deleteMany({});
  await prisma.deal.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.vendorProduct.deleteMany({});
  await prisma.inventory.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.vendor.deleteMany({});
  await prisma.contact.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('All data cleared.');

  const hashedPassword = await bcrypt.hash('admin123', 10);

  const superAdmin = await prisma.user.create({
    data: {
      email: 'admin@eorbitor.com',
      passwordHash: hashedPassword,
      firstName: 'Admin',
      lastName: '',
      role: 'SUPER_ADMIN',
      department: 'Administration',
      isActive: true,
    },
  });

  console.log('\n✅ Database seed completed successfully!');
  console.log('\nLogin credentials:');
  console.log(`  Email:    ${superAdmin.email}`);
  console.log(`  Password: admin123`);
  console.log(`  Role:     ${superAdmin.role}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
