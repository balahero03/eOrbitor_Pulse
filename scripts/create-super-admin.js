const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  try {
    // Check if super admin exists
    const existingSuperAdmin = await prisma.user.findUnique({
      where: { email: 'superadmin@eorbitor.com' }
    });

    if (existingSuperAdmin) {
      console.log('✓ Super Admin already exists:', existingSuperAdmin.email);
      console.log('\nCredentials:');
      console.log('  Email: superadmin@eorbitor.com');
      console.log('  Password: SuperAdmin@123');
      console.log('  Role: SUPER_ADMIN');
      return;
    }

    // Create super admin user
    const passwordHash = await bcrypt.hash('SuperAdmin@123', 10);
    const superAdmin = await prisma.user.create({
      data: {
        email: 'superadmin@eorbitor.com',
        firstName: 'Super',
        lastName: 'Admin',
        passwordHash,
        role: 'SUPER_ADMIN',
        isActive: true,
        department: 'Administration'
      }
    });

    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║        🔐 SUPER ADMIN ACCOUNT CREATED            ║');
    console.log('╚════════════════════════════════════════════════════╝\n');
    console.log('✓ Super Admin Account Successfully Created!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📧 Email:         superadmin@eorbitor.com');
    console.log('🔑 Password:      SuperAdmin@123');
    console.log('👤 Name:          Super Admin');
    console.log('🎯 Role:          SUPER_ADMIN');
    console.log('✅ Status:        Active');
    console.log('🏢 Department:    Administration');
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🚀 Login at: http://localhost:3000/login\n');
    console.log('Capabilities:');
    console.log('  ✓ Full system access');
    console.log('  ✓ Manage all users');
    console.log('  ✓ View all reports');
    console.log('  ✓ System settings');
    console.log('  ✓ User management');
    console.log('  ✓ Announcements');
    console.log('  ✓ Approvals management\n');

  } catch (error) {
    console.error('❌ Error creating super admin:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
