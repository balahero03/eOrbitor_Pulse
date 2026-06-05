/**
 * Comprehensive mock data seed for eOrbitor Pulse
 * Run: DATABASE_URL="..." node scripts/seed-mockdata.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ─── Existing user IDs ────────────────────────────────────────────────────────
const USERS = {
  john:      { id: 'cmpz4r3b30000e9ehvqu75lod', name: 'John Doe',     role: 'SALES_EXEC' },
  jane:      { id: 'cmpz4r3d00001e9ehlrvvwllf', name: 'Jane Smith',   role: 'SALES_MANAGER' },
  superadmin:{ id: 'cmpz59jur0000v6416b2wigsb', name: 'Super Admin',  role: 'SUPER_ADMIN' },
  johnS:     { id: 'cmpz4n0r70001fh1idqqr0t5o', name: 'John Sales',   role: 'SALES_EXEC' },
  adminComp: { id: 'cmpz4n0r30000fh1iqzlgp4v3', name: 'Admin User',   role: 'ADMIN' },
  adminEx:   { id: 'cmpz4r3em0002e9ehmmdsk4y6', name: 'Admin User',   role: 'ADMIN' },
};

const SALES_EXECS = [USERS.john.id, USERS.johnS.id];
const MANAGERS    = [USERS.jane.id, USERS.adminEx.id];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randDecimal(min, max) { return parseFloat((Math.random() * (max - min) + min).toFixed(2)); }

// ─── Reference data ───────────────────────────────────────────────────────────
const INDUSTRIES = ['IT Services', 'Manufacturing', 'Healthcare', 'Education', 'Retail', 'Finance', 'Logistics', 'Real Estate', 'Pharma', 'Automobile'];
const COMPANIES  = [
  'Tata Consultancy', 'Infosys Ltd', 'Wipro Systems', 'HCL Technologies', 'Tech Mahindra',
  'Reliance Jio', 'Bajaj Auto', 'Mahindra Group', 'Sun Pharma', 'Apollo Hospitals',
  'HDFC Bank', 'ICICI Solutions', 'Axis Finance', 'Biocon Research', 'Flipkart Commerce',
  'Zomato Eats', 'Swiggy Delivery', 'OLA Mobility', 'Ola Electric', 'Paytm Payments',
  'Airtel Networks', 'Vodafone India', 'BSNL Telecom', 'Coal India Ltd', 'NTPC Power',
  'Siemens India', 'Honeywell Auto', 'Bosch India', 'ABB Systems', 'Schneider Electric',
];
const LEAD_SOURCES = ['WEBSITE','REFERRAL','WALKIN','CALL','EMAIL','ADVERTISEMENT'];
const LEAD_STATUSES_OPEN   = ['NEW','CONTACTED','QUALIFIED','SUSPECT','PROSPECT','APPROACH','NEGOTIATION','CLOSURE'];
const LEAD_STATUSES_CLOSED = ['WON','LOST','DROPPED','ORDER'];
const DEAL_STAGES = ['SUSPECT','PROSPECT','APPROACH','NEGOTIATION','CLOSURE','ONGOING'];
const FOLLOWUP_TYPES = ['CALL','EMAIL','MEETING','WHATSAPP','SITE_VISIT'];
const SOLUTION_AREAS = ['Networking', 'Cloud', 'Security', 'Storage', 'Servers', 'CCTV', 'Biometrics', 'Software', 'Consulting', 'Support'];
const OEM_NAMES = ['Cisco', 'Dell', 'HP', 'Lenovo', 'Fortinet', 'Palo Alto', 'Juniper', 'VMware', 'Microsoft', 'IBM'];
const PRODUCT_CATEGORIES = ['Networking', 'Security', 'Storage', 'Servers', 'Software', 'Peripherals'];

const TASK_TITLES = [
  'Follow up on proposal', 'Send quotation', 'Schedule demo call',
  'Prepare presentation', 'Review contract terms', 'Submit RFQ response',
  'Update CRM records', 'Coordinate with pre-sales', 'Send product brochure',
  'Confirm meeting time', 'Review payment terms', 'Conduct site visit',
  'Prepare POC report', 'Escalate to manager', 'Collect PO from client',
];

const ANNOUNCEMENT_TITLES = [
  { title: 'Q2 Sales Target Achieved!', content: 'Great news! We have successfully achieved our Q2 sales target of ₹5 Crore. Congratulations to the entire sales team for their outstanding performance. Keep up the excellent work!' },
  { title: 'New Product Launch: Cisco Catalyst 9300', content: 'We are excited to announce the addition of Cisco Catalyst 9300 series switches to our product catalog. This enterprise-grade solution offers superior performance for campus networks. Training sessions will be scheduled next week.' },
  { title: 'CRM System Update - New Reports Module', content: 'The eOrbitor Pulse CRM has been updated with a comprehensive Sales Reports module. You can now generate Personal, Team, and Pipeline reports with custom date ranges. Login to explore the new Analytics section.' },
  { title: 'Holiday Notice - Independence Day', content: 'Please note that the office will remain closed on August 15th for Independence Day. All pending client communications should be addressed before August 14th. Emergency contacts are available on the company portal.' },
  { title: 'Sales Training: Advanced Negotiation Skills', content: 'A 2-day training program on Advanced Negotiation Skills has been scheduled for all Sales Executives and Managers. The training will be held at the Bangalore office. Registration is mandatory. Please confirm your attendance.' },
];

async function main() {
  console.log('\n🌱 Starting mock data seed...\n');

  // ── 1. Update managers for sales execs ────────────────────────────────────
  await prisma.user.update({ where: { id: USERS.john.id }, data: { managerId: USERS.jane.id } });
  await prisma.user.update({ where: { id: USERS.johnS.id }, data: { managerId: USERS.jane.id } });
  console.log('✅ Manager relationships set');

  // ── 2. Products ────────────────────────────────────────────────────────────
  const productData = [
    { sku: 'CISCO-CAT-9300', name: 'Cisco Catalyst 9300 Switch', category: 'Networking', oemName: 'Cisco', basePrice: 185000, tax: 18, description: '48-port enterprise switch with PoE+' },
    { sku: 'CISCO-ASA-5516', name: 'Cisco ASA 5516-X Firewall', category: 'Security', oemName: 'Cisco', basePrice: 320000, tax: 18, description: 'Next-gen firewall with FirePOWER services' },
    { sku: 'DELL-PWR-R750', name: 'Dell PowerEdge R750 Server', category: 'Servers', oemName: 'Dell', basePrice: 480000, tax: 18, description: '2U rack server, Xeon Silver, 128GB RAM' },
    { sku: 'HP-HPE-MSA2060', name: 'HPE MSA 2060 SAN Storage', category: 'Storage', oemName: 'HP', basePrice: 650000, tax: 18, description: '12Gb SAS SAN storage array' },
    { sku: 'FORT-FG-100F', name: 'Fortinet FortiGate 100F', category: 'Security', oemName: 'Fortinet', basePrice: 210000, tax: 18, description: 'NGFW with SD-WAN, 10Gbps throughput' },
    { sku: 'LENOVO-SR650', name: 'Lenovo ThinkSystem SR650', category: 'Servers', oemName: 'Lenovo', basePrice: 420000, tax: 18, description: '2U rack server, Xeon Gold, 256GB RAM' },
    { sku: 'VMWARE-ENT-01', name: 'VMware vSphere Enterprise Plus', category: 'Software', oemName: 'VMware', basePrice: 95000, tax: 18, description: 'vSphere 8 Enterprise Plus per-CPU license' },
    { sku: 'MS-AZURE-01', name: 'Microsoft 365 Business Premium', category: 'Software', oemName: 'Microsoft', basePrice: 1200, tax: 18, description: 'Per-user per-month license' },
    { sku: 'JUNIPER-EX4300', name: 'Juniper EX4300 Switch', category: 'Networking', oemName: 'Juniper', basePrice: 145000, tax: 18, description: '48-port gigabit switch with 40GbE uplinks' },
    { sku: 'PALO-PA-820', name: 'Palo Alto Networks PA-820', category: 'Security', oemName: 'Palo Alto', basePrice: 580000, tax: 18, description: 'Next-gen firewall, 1Gbps App-ID' },
    { sku: 'CISCO-AP-9120', name: 'Cisco Aironet 9120 AP', category: 'Networking', oemName: 'Cisco', basePrice: 42000, tax: 18, description: 'Wi-Fi 6 indoor access point' },
    { sku: 'DELL-VXRAIL', name: 'Dell VxRail HCI Appliance', category: 'Storage', oemName: 'Dell', basePrice: 1250000, tax: 18, description: 'Hyper-converged infrastructure node' },
  ];

  const products = [];
  for (const p of productData) {
    const prod = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: {
        ...p,
        basePrice: p.basePrice,
        tax: p.tax,
        isActive: true,
        attributes: { warranty: '3 years', type: p.category },
        inventory: { create: { quantity: rand(5, 50), reorderLevel: 5 } },
      },
    });
    products.push(prod);
  }
  console.log(`✅ ${products.length} products created`);

  // ── 3. Customers ───────────────────────────────────────────────────────────
  const customerData = COMPANIES.slice(0, 20).map((name, i) => ({
    companyName: name,
    gstNumber: `29ABCDE${String(i + 1000).padStart(4, '0')}F${i + 1}Z${i + 5}`,
    industry: pick(INDUSTRIES),
    website: `https://www.${name.toLowerCase().replace(/\s+/g, '')}.com`,
    annualRevenue: randDecimal(5000000, 500000000),
    customerCategory: pick(['PROSPECT','ACTIVE','ACTIVE','ACTIVE','INACTIVE']),
    billingAddress: { line1: `${rand(1, 999)}, ${pick(['MG Road', 'Brigade Road', 'Whitefield', 'Electronic City', 'Koramangala'])}`, city: pick(['Bangalore', 'Chennai', 'Mumbai', 'Hyderabad', 'Pune']), state: 'Karnataka', pincode: String(rand(560001, 560100)) },
  }));

  const customers = [];
  for (const c of customerData) {
    const cust = await prisma.customer.upsert({
      where: { gstNumber: c.gstNumber },
      update: {},
      create: {
        ...c,
        contacts: {
          create: [
            { name: `${pick(['Rajesh','Suresh','Priya','Anita','Vikram','Deepa','Mohan','Sanjay'])} ${pick(['Kumar','Sharma','Patel','Singh','Reddy','Nair','Iyer','Rao'])}`, email: `contact${customers.length + 1}@${c.companyName.toLowerCase().replace(/\s+/g, '')}.com`, phone: `+91${rand(7000000000, 9999999999)}`, designation: pick(['IT Manager', 'CTO', 'Procurement Head', 'Finance Manager', 'CEO', 'VP-IT']), isPrimary: true },
          ],
        },
      },
    });
    customers.push(cust);
  }
  console.log(`✅ ${customers.length} customers created`);

  // ── 4. Leads ───────────────────────────────────────────────────────────────
  const leads = [];

  // Open leads spread across last 90 days
  for (let i = 0; i < 40; i++) {
    const assignedTo = pick(SALES_EXECS);
    const createdDaysAgo = rand(1, 90);
    const status = pick(LEAD_STATUSES_OPEN);
    const customer = pick(customers);

    const lead = await prisma.lead.create({
      data: {
        name: pick(['Rajesh Kumar', 'Anita Singh', 'Priya Patel', 'Vikram Reddy', 'Suresh Nair', 'Deepa Iyer', 'Mohan Rao', 'Sanjay Sharma', 'Kavya Menon', 'Arjun Pillai']),
        email: `lead${i + 1}@${customer.companyName.toLowerCase().replace(/\s+/g, '')}.com`,
        phone: `+91${rand(7000000000, 9999999999)}`,
        company: customer.companyName,
        source: pick(LEAD_SOURCES),
        status,
        leadScore: rand(20, 95),
        qualificationNotes: pick(['High budget, decision maker engaged', 'Technical evaluation ongoing', 'Competitor comparison in progress', 'POC requested', 'Budget approval pending', 'Strong intent to buy', null]),
        assignedToId: assignedTo,
        linkedCustomerId: customer.id,
        nextFollowUp: daysFromNow(rand(1, 14)),
        followUpDate: daysFromNow(rand(1, 7)),
        expectedClosureDate: daysFromNow(rand(15, 60)),
        quoteNo: rand(1, 3) > 1 ? `QT-2026-${String(i + 100).padStart(4, '0')}` : null,
        quoteValue: rand(1, 3) > 1 ? randDecimal(50000, 2000000) : null,
        rfqDate: rand(1, 2) === 1 ? daysAgo(rand(5, 30)) : null,
        solutionAreas: [pick(SOLUTION_AREAS), pick(SOLUTION_AREAS)].filter((v, i, a) => a.indexOf(v) === i),
        oemNames: [pick(OEM_NAMES), pick(OEM_NAMES)].filter((v, i, a) => a.indexOf(v) === i),
        presalesIds: [],
        createdAt: daysAgo(createdDaysAgo),
      },
    });
    leads.push(lead);
  }

  // Closed won leads (last 90 days - for reports data)
  for (let i = 0; i < 25; i++) {
    const assignedTo = pick(SALES_EXECS);
    const closedDaysAgo = rand(1, 85);
    const createdDaysAgo = closedDaysAgo + rand(10, 45);
    const customer = pick(customers);

    const lead = await prisma.lead.create({
      data: {
        name: pick(['Rajesh Kumar', 'Anita Singh', 'Priya Patel', 'Vikram Reddy', 'Suresh Nair', 'Deepa Iyer', 'Mohan Rao', 'Sanjay Sharma']),
        email: `won${i + 1}@${customer.companyName.toLowerCase().replace(/\s+/g, '')}.com`,
        phone: `+91${rand(7000000000, 9999999999)}`,
        company: customer.companyName,
        source: pick(LEAD_SOURCES),
        status: pick(['WON', 'WON', 'ORDER']),
        leadScore: rand(70, 100),
        qualificationNotes: 'Deal closed successfully. PO received.',
        assignedToId: assignedTo,
        linkedCustomerId: customer.id,
        quoteNo: `QT-2026-W${String(i + 200).padStart(4, '0')}`,
        quoteValue: randDecimal(150000, 3500000),
        closedAt: daysAgo(closedDaysAgo),
        poReceivedDate: daysAgo(closedDaysAgo - 2),
        solutionAreas: [pick(SOLUTION_AREAS)],
        oemNames: [pick(OEM_NAMES)],
        presalesIds: [],
        createdAt: daysAgo(createdDaysAgo),
      },
    });
    leads.push(lead);
  }

  // Closed lost leads
  for (let i = 0; i < 15; i++) {
    const assignedTo = pick(SALES_EXECS);
    const closedDaysAgo = rand(5, 80);
    const customer = pick(customers);

    const lead = await prisma.lead.create({
      data: {
        name: pick(['Rajesh Kumar', 'Anita Singh', 'Priya Patel', 'Vikram Reddy']),
        email: `lost${i + 1}@${customer.companyName.toLowerCase().replace(/\s+/g, '')}.com`,
        phone: `+91${rand(7000000000, 9999999999)}`,
        company: customer.companyName,
        source: pick(LEAD_SOURCES),
        status: pick(['LOST', 'DROPPED']),
        leadScore: rand(10, 60),
        qualificationNotes: pick(['Lost to competitor', 'Budget constraints', 'Project postponed', 'No decision made', 'Changed requirements']),
        assignedToId: assignedTo,
        linkedCustomerId: customer.id,
        closedAt: daysAgo(closedDaysAgo),
        closureReason: pick(['Price too high', 'Competitor selected', 'Budget cut', 'Project on hold', 'No response']),
        solutionAreas: [pick(SOLUTION_AREAS)],
        oemNames: [pick(OEM_NAMES)],
        presalesIds: [],
        createdAt: daysAgo(closedDaysAgo + rand(10, 30)),
      },
    });
    leads.push(lead);
  }

  console.log(`✅ ${leads.length} leads created`);

  // ── 5. Deals ───────────────────────────────────────────────────────────────
  const deals = [];
  for (let i = 0; i < 30; i++) {
    const assignedTo = pick(SALES_EXECS);
    const customer = pick(customers);
    const stage = pick(DEAL_STAGES);
    const probMap = { SUSPECT: 10, PROSPECT: 25, APPROACH: 40, NEGOTIATION: 65, CLOSURE: 80, ONGOING: 90 };

    const deal = await prisma.deal.create({
      data: {
        dealName: `${customer.companyName} - ${pick(['Network Upgrade', 'Security Solution', 'Server Refresh', 'Cloud Migration', 'DC Expansion', 'Wi-Fi Rollout', 'Backup Solution', 'HCI Deployment'])}`,
        customerId: customer.id,
        leadId: pick(leads.filter(l => !['WON','ORDER','LOST','DROPPED'].includes(l.status)))?.id ?? null,
        dealValue: randDecimal(200000, 5000000),
        stage,
        winProbability: probMap[stage] + rand(-5, 10),
        expectedCloseDate: daysFromNow(rand(7, 90)),
        assignedToId: assignedTo,
        nextAction: pick(['Send detailed proposal', 'Schedule technical demo', 'Follow up on RFQ', 'Conduct POC', 'Negotiate commercials', 'Collect PO', 'Submit revised quote', null]),
        createdAt: daysAgo(rand(5, 60)),
      },
    });
    deals.push(deal);
  }
  console.log(`✅ ${deals.length} deals created`);

  // ── 6. Follow-ups ──────────────────────────────────────────────────────────
  const followups = [];
  for (let i = 0; i < 50; i++) {
    const deal = pick(deals);
    const lead = pick(leads.filter(l => !['WON','ORDER','LOST','DROPPED'].includes(l.status)));
    const daysOffset = rand(-30, 14);
    const isCompleted = daysOffset < 0;

    const fu = await prisma.followUp.create({
      data: {
        dealId: deal.id,
        leadId: lead?.id ?? null,
        type: pick(FOLLOWUP_TYPES),
        scheduledDate: daysAgo(-daysOffset),
        actualDate: isCompleted ? daysAgo(-daysOffset + rand(0, 1)) : null,
        durationMinutes: isCompleted ? pick([15, 30, 45, 60, 90]) : null,
        notes: pick([
          'Discussed technical requirements and current infrastructure',
          'Client is evaluating 3 vendors, we are shortlisted',
          'Budget approved, waiting for formal PO',
          'Technical team visit scheduled next week',
          'Price negotiation ongoing, client expects 10% discount',
          'Demo went well, client impressed with the solution',
          'Follow up on quotation sent last week',
          'Client requested revised proposal with updated specs',
          null,
        ]),
        outcome: isCompleted ? pick(['Positive - will revert with decision', 'Meeting scheduled', 'Awaiting internal approval', 'PO expected by end of month', 'Technical evaluation in progress']) : null,
        nextAction: isCompleted ? pick(['Send revised quote', 'Schedule site visit', 'Wait for decision', 'Follow up in 3 days', 'Prepare POC plan']) : null,
        createdById: deal.assignedToId,
        createdAt: daysAgo(rand(1, 45)),
      },
    });
    followups.push(fu);
  }
  console.log(`✅ ${followups.length} follow-ups created`);

  // ── 7. Tasks ───────────────────────────────────────────────────────────────
  const tasks = [];
  for (let i = 0; i < 40; i++) {
    const assignedTo = pick([...SALES_EXECS, ...MANAGERS]);
    const createdBy = pick([...MANAGERS, USERS.superadmin.id]);
    const statusOptions = ['TODO', 'TODO', 'IN_PROGRESS', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    const status = pick(statusOptions);
    const dueOffset = status === 'COMPLETED' ? -rand(1, 20) : rand(-5, 30);

    const task = await prisma.task.create({
      data: {
        title: pick(TASK_TITLES),
        description: pick([
          'Ensure all documentation is ready before the client meeting.',
          'Coordinate with pre-sales team for technical support.',
          'Include pricing breakdown and implementation timeline.',
          'Review competitor pricing and adjust accordingly.',
          'Get written confirmation from client procurement team.',
          null,
        ]),
        status,
        priority: pick(['LOW', 'MEDIUM', 'MEDIUM', 'HIGH', 'URGENT']),
        dueDate: daysAgo(-dueOffset),
        assignedToId: assignedTo,
        createdById: createdBy,
        relatedDealId: rand(1, 3) > 1 ? pick(deals).id : null,
        completedAt: status === 'COMPLETED' ? daysAgo(rand(1, 10)) : null,
        tags: [pick(['urgent', 'client-facing', 'follow-up', 'proposal', 'demo', 'admin'])],
        createdAt: daysAgo(rand(1, 30)),
      },
    });
    tasks.push(task);
  }
  console.log(`✅ ${tasks.length} tasks created`);

  // ── 8. Quotations ─────────────────────────────────────────────────────────
  const quotations = [];
  for (let i = 0; i < 20; i++) {
    const deal = pick(deals);
    const createdBy = deal.assignedToId;
    const status = pick(['DRAFT', 'SENT', 'SENT', 'ACCEPTED', 'ACCEPTED', 'REJECTED', 'EXPIRED']);
    const itemProduct = pick(products);
    const qty = rand(1, 10);
    const unitPrice = parseFloat(itemProduct.basePrice.toString());
    const subtotal = unitPrice * qty;
    const taxAmount = (subtotal * parseFloat(itemProduct.tax.toString())) / 100;
    const total = subtotal + taxAmount;

    const quot = await prisma.quotation.create({
      data: {
        quotationNumber: `QN-2026-${String(i + 1001).padStart(5, '0')}`,
        customerId: deal.customerId,
        dealId: deal.id,
        status,
        issueDate: daysAgo(rand(5, 60)),
        expiryDate: daysFromNow(rand(10, 30)),
        priceValidity: '30 days',
        warranty: '3 years on-site',
        amcPeriod: '1 year post-warranty',
        deliveryEstimate: `${rand(2, 8)} weeks ARO`,
        paymentTerms: pick(['30% advance, 70% on delivery', '100% advance', 'Net 30 days', '50% advance, 50% on delivery']),
        items: [
          {
            productId: itemProduct.id,
            productName: itemProduct.name,
            sku: itemProduct.sku,
            quantity: qty,
            unitPrice,
            discount: pick([0, 5, 10, 15]),
            taxRate: parseFloat(itemProduct.tax.toString()),
            total: total,
          },
        ],
        subtotal,
        taxAmount,
        discountAmount: 0,
        totalAmount: total,
        notes: pick(['Prices are exclusive of installation charges', 'Subject to availability', 'Government levy extra if applicable', null]),
        sentAt: ['SENT', 'ACCEPTED', 'REJECTED'].includes(status) ? daysAgo(rand(1, 10)) : null,
        createdById: createdBy,
        revision: 1,
        createdAt: daysAgo(rand(1, 50)),
      },
    });
    quotations.push(quot);
  }
  console.log(`✅ ${quotations.length} quotations created`);

  // ── 9. Orders ─────────────────────────────────────────────────────────────
  const orders = [];
  const acceptedQuots = quotations.filter(q => q.status === 'ACCEPTED');
  for (let i = 0; i < Math.min(acceptedQuots.length, 10); i++) {
    const quot = acceptedQuots[i];
    const orderStatus = pick(['PENDING', 'CONFIRMED', 'FULFILLED', 'INVOICED', 'COMPLETED']);
    const payStatus = orderStatus === 'COMPLETED' ? 'COMPLETED' : pick(['PENDING', 'PARTIAL', 'COMPLETED']);

    const order = await prisma.order.create({
      data: {
        orderNumber: `PO-2026-${String(i + 3001).padStart(5, '0')}`,
        quotationId: quot.id,
        customerId: quot.customerId,
        dealId: quot.dealId,
        poNumber: `CUST-PO-${rand(1000, 9999)}`,
        poDate: daysAgo(rand(1, 20)),
        status: orderStatus,
        deliveryDate: daysFromNow(rand(7, 45)),
        totalAmount: quot.totalAmount,
        amountPaid: payStatus === 'COMPLETED' ? quot.totalAmount : payStatus === 'PARTIAL' ? parseFloat((parseFloat(quot.totalAmount.toString()) * 0.3).toFixed(2)) : 0,
        paymentStatus: payStatus,
        paymentMode: payStatus !== 'PENDING' ? pick(['NEFT', 'RTGS', 'Cheque', 'UPI']) : null,
        paymentRemarks: payStatus !== 'PENDING' ? 'Payment received as per terms' : null,
        deliveredAt: orderStatus === 'COMPLETED' ? daysAgo(rand(1, 10)) : null,
        createdAt: daysAgo(rand(1, 15)),
      },
    });
    orders.push(order);
  }
  console.log(`✅ ${orders.length} orders created`);

  // ── 10. Activity Logs ─────────────────────────────────────────────────────
  const allActions = ['CREATE', 'UPDATE', 'VIEW', 'SEND_EMAIL'];
  const actLogs = [];

  // Lead activity logs
  for (const lead of leads.slice(0, 30)) {
    for (let i = 0; i < rand(2, 5); i++) {
      const log = await prisma.activityLog.create({
        data: {
          userId: lead.assignedToId,
          action: pick(allActions),
          entityType: 'Lead',
          entityId: lead.id,
          leadId: lead.id,
          changes: { field: pick(['status', 'quoteValue', 'nextFollowUp', 'remarks']), note: 'Updated via CRM' },
          createdAt: daysAgo(rand(0, 60)),
        },
      });
      actLogs.push(log);
    }
  }

  // Deal activity logs
  for (const deal of deals.slice(0, 20)) {
    for (let i = 0; i < rand(1, 3); i++) {
      const log = await prisma.activityLog.create({
        data: {
          userId: deal.assignedToId,
          action: pick(allActions),
          entityType: 'Deal',
          entityId: deal.id,
          dealId: deal.id,
          changes: { field: pick(['stage', 'winProbability', 'nextAction']), note: 'Stage updated' },
          createdAt: daysAgo(rand(0, 45)),
        },
      });
      actLogs.push(log);
    }
  }

  console.log(`✅ ${actLogs.length} activity logs created`);

  // ── 11. Announcements ─────────────────────────────────────────────────────
  const announcements = [];
  for (let i = 0; i < ANNOUNCEMENT_TITLES.length; i++) {
    const a = await prisma.announcement.create({
      data: {
        title: ANNOUNCEMENT_TITLES[i].title,
        content: ANNOUNCEMENT_TITLES[i].content,
        createdById: pick([USERS.superadmin.id, USERS.adminEx.id, USERS.adminComp.id]),
        isPublished: i < 3,
        publishedAt: i < 3 ? daysAgo(rand(1, 20)) : null,
        priority: pick(['LOW', 'NORMAL', 'NORMAL', 'HIGH']),
        expiresAt: daysFromNow(rand(7, 60)),
      },
    });
    announcements.push(a);
  }
  console.log(`✅ ${announcements.length} announcements created`);

  // ── 12. Notifications ─────────────────────────────────────────────────────
  const notifTypes = ['FOLLOW_UP_REMINDER', 'TASK_DUE', 'DEAL_UPDATED', 'LEAD_ASSIGNED', 'QUOTATION_APPROVED'];
  let notifCount = 0;
  for (const userId of [...SALES_EXECS, ...MANAGERS]) {
    for (let i = 0; i < 6; i++) {
      const ntype = pick(notifTypes);
      await prisma.notification.create({
        data: {
          userId,
          type: ntype,
          title: ntype === 'FOLLOW_UP_REMINDER' ? 'Follow-up due today' :
                 ntype === 'TASK_DUE'           ? 'Task deadline approaching' :
                 ntype === 'DEAL_UPDATED'        ? 'Deal stage updated' :
                 ntype === 'LEAD_ASSIGNED'       ? 'New lead assigned to you' :
                                                   'Quotation approved by client',
          message: pick([
            'You have a scheduled follow-up call at 3:00 PM today.',
            'Task "Send quotation" is due tomorrow.',
            'Deal moved to Negotiation stage.',
            'A new lead from Wipro Systems has been assigned.',
            'Client has approved your quotation QN-2026-01002.',
          ]),
          isRead: rand(1, 3) > 1,
          readAt: rand(1, 2) === 1 ? daysAgo(rand(0, 5)) : null,
          createdAt: daysAgo(rand(0, 14)),
        },
      });
      notifCount++;
    }
  }
  console.log(`✅ ${notifCount} notifications created`);

  // ── 13. Daily Activities ──────────────────────────────────────────────────
  let dailyCount = 0;
  const allActiveUsers = [...SALES_EXECS, ...MANAGERS];
  for (const userId of allActiveUsers) {
    for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
      if (dayOffset % 7 === 0 || dayOffset % 7 === 6) continue; // skip weekends approx
      const date = daysAgo(dayOffset);
      const dateStr = date.toISOString().split('T')[0];
      const loginHour = rand(8, 10);
      const logoutHour = rand(17, 19);
      const loginTime = new Date(date); loginTime.setHours(loginHour, rand(0, 30), 0, 0);
      const logoutTime = new Date(date); logoutTime.setHours(logoutHour, rand(0, 30), 0, 0);

      try {
        await prisma.dailyActivity.create({
          data: {
            userId,
            date: dateStr,
            activities: pick([
              'Called 5 clients, followed up on 3 proposals, updated CRM records',
              'Client meeting at Whitefield office, demo conducted, quotation sent',
              'Reviewed pipeline deals, updated stages, follow-up calls done',
              'Attended team review meeting, prepared monthly report, submitted proposals',
              'Site visit to client premises, technical discussion with IT team',
              'Cold calls - 10 prospects, 3 positive responses, scheduled 2 demos',
            ]),
            loginTime,
            logoutTime,
            totalHours: parseFloat(((logoutHour - loginHour) + rand(0, 1) * 0.5).toFixed(2)),
            isEditable: dayOffset > 0,
            createdAt: date,
          },
        });
        dailyCount++;
      } catch {
        // skip duplicates silently
      }
    }
  }
  console.log(`✅ ${dailyCount} daily activity entries created`);

  // ── Summary ───────────────────────────────────────────────────────────────
  const counts = await Promise.all([
    prisma.user.count(),
    prisma.lead.count(),
    prisma.customer.count(),
    prisma.deal.count(),
    prisma.followUp.count(),
    prisma.task.count(),
    prisma.quotation.count(),
    prisma.order.count(),
    prisma.product.count(),
    prisma.activityLog.count(),
    prisma.announcement.count(),
  ]);

  console.log('\n' + '═'.repeat(50));
  console.log('📊 DATABASE SUMMARY');
  console.log('═'.repeat(50));
  const labels = ['Users','Leads','Customers','Deals','Follow-ups','Tasks','Quotations','Orders','Products','Activity Logs','Announcements'];
  labels.forEach((l, i) => console.log(`  ${l.padEnd(20)} ${counts[i]}`));
  console.log('═'.repeat(50));
  console.log('\n✅ Mock data seed complete!\n');
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
