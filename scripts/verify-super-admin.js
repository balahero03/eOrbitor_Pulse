const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    const superAdmin = await prisma.user.findUnique({
      where: { email: 'superadmin@eorbitor.com' }
    });

    if (superAdmin) {
      console.log('\n✅ SUPER ADMIN ACCOUNT VERIFIED\n');
      console.log('═'.repeat(50));
      console.log(`Email:        ${superAdmin.email}`);
      console.log(`Name:         ${superAdmin.firstName} ${superAdmin.lastName}`);
      console.log(`Role:         ${superAdmin.role}`);
      console.log(`Status:       ${superAdmin.isActive ? '✅ Active' : '❌ Inactive'}`);
      console.log(`Department:   ${superAdmin.department || 'N/A'}`);
      console.log(`Created:      ${new Date(superAdmin.createdAt).toLocaleString('en-IN')}`);
      console.log('═'.repeat(50));
      console.log('\n🚀 You can now login with:');
      console.log('   Email:    superadmin@eorbitor.com');
      console.log('   Password: SuperAdmin@123\n');
    } else {
      console.log('❌ Super admin account not found');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
