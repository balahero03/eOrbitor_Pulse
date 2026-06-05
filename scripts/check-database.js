const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║          DATABASE INVENTORY - eOrbitor Pulse                   ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // Users
    const users = await prisma.user.findMany();
    console.log(`📊 USERS (${users.length})`);
    console.log('━'.repeat(60));
    users.forEach(u => {
      console.log(`  ${u.email} | ${u.firstName} ${u.lastName} | ${u.role} | Active: ${u.isActive}`);
    });

    // Leads
    const leads = await prisma.lead.count();
    const leadsByStatus = await prisma.lead.groupBy({
      by: ['status'],
      _count: true
    });
    console.log(`\n📋 LEADS (${leads} total)`);
    console.log('━'.repeat(60));
    if (leadsByStatus.length > 0) {
      leadsByStatus.forEach(s => {
        console.log(`  ${s.status}: ${s._count}`);
      });
    } else {
      console.log('  (No leads found)');
    }

    // Customers
    const customers = await prisma.customer.count();
    console.log(`\n🏢 CUSTOMERS (${customers})`);
    console.log('━'.repeat(60));
    if (customers > 0) {
      const custList = await prisma.customer.findMany({ take: 5 });
      custList.forEach(c => {
        console.log(`  ${c.companyName} | Category: ${c.customerCategory}`);
      });
      if (customers > 5) console.log(`  ... and ${customers - 5} more`);
    } else {
      console.log('  (No customers found)');
    }

    // Deals
    const deals = await prisma.deal.count();
    const dealsByStage = await prisma.deal.groupBy({
      by: ['stage'],
      _count: true,
      _sum: { dealValue: true }
    });
    console.log(`\n💼 DEALS (${deals} total)`);
    console.log('━'.repeat(60));
    if (dealsByStage.length > 0) {
      dealsByStage.forEach(s => {
        const value = s._sum.dealValue ? `₹${Number(s._sum.dealValue).toLocaleString('en-IN')}` : '₹0';
        console.log(`  ${s.stage}: ${s._count} deals | ${value}`);
      });
    } else {
      console.log('  (No deals found)');
    }

    // Orders
    const orders = await prisma.order.count();
    const ordersByStatus = await prisma.order.groupBy({
      by: ['status'],
      _count: true,
      _sum: { totalAmount: true }
    });
    console.log(`\n📦 ORDERS (${orders})`);
    console.log('━'.repeat(60));
    if (ordersByStatus.length > 0) {
      ordersByStatus.forEach(s => {
        const value = s._sum.totalAmount ? `₹${Number(s._sum.totalAmount).toLocaleString('en-IN')}` : '₹0';
        console.log(`  ${s.status}: ${s._count} orders | ${value}`);
      });
    } else {
      console.log('  (No orders found)');
    }

    // Quotations
    const quotations = await prisma.quotation.count();
    const quotsByStatus = await prisma.quotation.groupBy({
      by: ['status'],
      _count: true,
      _sum: { totalAmount: true }
    });
    console.log(`\n📄 QUOTATIONS (${quotations})`);
    console.log('━'.repeat(60));
    if (quotsByStatus.length > 0) {
      quotsByStatus.forEach(s => {
        const value = s._sum.totalAmount ? `₹${Number(s._sum.totalAmount).toLocaleString('en-IN')}` : '₹0';
        console.log(`  ${s.status}: ${s._count} quotations | ${value}`);
      });
    } else {
      console.log('  (No quotations found)');
    }

    // Tasks
    const tasks = await prisma.task.count();
    const tasksByStatus = await prisma.task.groupBy({
      by: ['status'],
      _count: true
    });
    console.log(`\n✅ TASKS (${tasks})`);
    console.log('━'.repeat(60));
    if (tasksByStatus.length > 0) {
      tasksByStatus.forEach(s => {
        console.log(`  ${s.status}: ${s._count}`);
      });
    } else {
      console.log('  (No tasks found)');
    }

    // Follow-ups
    const followups = await prisma.followUp.count();
    console.log(`\n🔔 FOLLOW-UPS (${followups})`);
    console.log('━'.repeat(60));
    if (followups > 0) {
      console.log(`  Total follow-ups: ${followups}`);
    } else {
      console.log('  (No follow-ups found)');
    }

    // Activities
    const activities = await prisma.activityLog.count();
    console.log(`\n📝 ACTIVITIES (${activities})`);
    console.log('━'.repeat(60));
    if (activities > 0) {
      console.log(`  Total activities: ${activities}`);
    } else {
      console.log('  (No activities found)');
    }

    // Reports
    let reports = 0;
    try {
      reports = await prisma.report.count();
      console.log(`\n📊 REPORTS (${reports})`);
      console.log('━'.repeat(60));
      if (reports > 0) {
        const reportList = await prisma.report.findMany({
          select: { type: true, generatedAt: true },
          orderBy: { generatedAt: 'desc' },
          take: 3
        });
        reportList.forEach(r => {
          console.log(`  ${r.type} | Generated: ${new Date(r.generatedAt).toLocaleString('en-IN')}`);
        });
        if (reports > 3) console.log(`  ... and ${reports - 3} more`);
      } else {
        console.log('  (No reports found)');
      }
    } catch (e) {
      console.log(`\n📊 REPORTS (unable to query - table may not exist)`);
      console.log('━'.repeat(60));
    }

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('SUMMARY');
    console.log('═'.repeat(60));
    const totalValue = await prisma.lead.aggregate({
      where: { status: { in: ['WON', 'ORDER'] } },
      _sum: { quoteValue: true }
    });

    const wonLeads = await prisma.lead.count({
      where: { status: { in: ['WON', 'ORDER'] } }
    });

    console.log(`Total Users: ${users.length}`);
    console.log(`Total Leads: ${leads}`);
    console.log(`Won Leads: ${wonLeads}`);
    console.log(`Total Customers: ${customers}`);
    console.log(`Total Deals: ${deals}`);
    console.log(`Total Orders: ${orders}`);
    console.log(`Won Revenue: ₹${Number(totalValue._sum.quoteValue || 0).toLocaleString('en-IN')}`);
    console.log('\n✅ Database check complete!\n');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
