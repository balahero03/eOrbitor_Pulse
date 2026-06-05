const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  try {
    // Check if test user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: 'john@example.com' }
    });

    if (existingUser) {
      console.log('✓ Test user already exists:', existingUser.email);
      return;
    }

    // Create test users
    const users = [
      {
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        password: 'password123',
        role: 'SALES_EXEC'
      },
      {
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        password: 'password123',
        role: 'SALES_MANAGER'
      },
      {
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        password: 'password123',
        role: 'ADMIN'
      }
    ];

    for (const userData of users) {
      const passwordHash = await bcrypt.hash(userData.password, 10);
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          passwordHash,
          role: userData.role,
          isActive: true
        }
      });
      console.log(`✓ Created user: ${user.email} (${user.role})`);
    }

    console.log('\n✓ All test users created successfully!');
    console.log('\nTest Credentials:');
    console.log('  Email: john@example.com | Password: password123 | Role: Sales Exec');
    console.log('  Email: jane@example.com | Password: password123 | Role: Sales Manager');
    console.log('  Email: admin@example.com | Password: password123 | Role: Admin');
  } catch (error) {
    console.error('Error creating users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
