const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

function parseDate(str) {
  if (!str || !str.trim()) return null;
  const parts = str.trim().split('-');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    const date = new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`);
    if (!isNaN(date)) return date;
  }
  return null;
}

function parseValue(str) {
  if (!str || !str.trim()) return null;
  const cleaned = str.replace(/[₹,\s"]/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

function mapStatus(csvStatus) {
  const map = {
    'won': 'WON',
    'lost': 'LOST',
    'suspect': 'SUSPECT',
    'prospect': 'PROSPECT',
    'nego': 'NEGOTIATION',
    'negotiation': 'NEGOTIATION',
    'commit': 'COMMIT',
    'dropped': 'DROPPED',
    'hold': 'ON_HOLD',
    'price pending': 'PROSPECT',
  };
  return map[(csvStatus || '').toLowerCase().trim()] || 'NEW';
}

function parseCSV(content) {
  const lines = content.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];
  let i = 1;
  while (i < lines.length) {
    let line = lines[i];
    // Handle multi-line quoted fields
    while ((line.match(/"/g) || []).length % 2 !== 0 && i + 1 < lines.length) {
      i++;
      line += '\n' + lines[i];
    }
    if (line.trim()) {
      const values = [];
      let cur = '', inQuote = false;
      for (const ch of line) {
        if (ch === '"') { inQuote = !inQuote; }
        else if (ch === ',' && !inQuote) { values.push(cur.trim()); cur = ''; }
        else { cur += ch; }
      }
      values.push(cur.trim());
      const row = {};
      headers.forEach((h, idx) => { row[h] = (values[idx] || '').replace(/^"|"$/g, ''); });
      if (row['S.NO'] && row['S.NO'].trim()) rows.push(row);
    }
    i++;
  }
  return rows;
}

async function main() {
  console.log('Starting lead import...');

  // Get admin user for assignment
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!adminUser) throw new Error('No admin user found. Run db:seed first.');

  // Get or create sales users from CSV managers
  const managerNames = [
    'Geetha', 'Srini', 'Hema', 'Krishnan', 'Jeevitha', 'Leo', 'Vaidy'
  ];

  const userMap = {};
  for (const name of managerNames) {
    let user = await prisma.user.findFirst({
      where: { firstName: { equals: name, mode: 'insensitive' } }
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: `${name.toLowerCase()}@company.local`,
          passwordHash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
          firstName: name,
          lastName: 'Manager',
          role: 'ON_FIELD_TEAM',
        }
      });
      console.log(`Created user: ${name}`);
    }
    userMap[name.toLowerCase()] = user.id;
  }
  userMap['admin'] = adminUser.id;

  function resolveUserId(name) {
    if (!name) return adminUser.id;
    // Handle "Srini/Hema" — take first name
    const first = name.split('/')[0].trim().toLowerCase();
    return userMap[first] || adminUser.id;
  }

  // Read CSV
  const csvPath = path.join(__dirname, "../csv's/Leads..csv");
  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(content);
  console.log(`Parsed ${rows.length} rows from CSV`);

  let created = 0, skipped = 0;

  for (const row of rows) {
    const quoteNo = row['S.NO']?.trim();
    const company = row['Customer name']?.trim();
    const oppName = row['Opp name']?.trim();
    const manager = row['Account Manager']?.trim();
    const status = mapStatus(row['Status']);
    const remarks = row['Remarks']?.trim() || null;
    const rfqDate = parseDate(row['RFQ Date']);
    const followUpDate = parseDate(row['Followup Date']);
    const poDate = parseDate(row['PO Received Date']);
    const quoteValue = parseValue(row['Quote Value']);

    if (!company || !quoteNo) { skipped++; continue; }

    // Check if already imported
    const exists = await prisma.lead.findFirst({ where: { quoteNo } });
    if (exists) { skipped++; continue; }

    const assignedToId = resolveUserId(manager);
    const broughtById = resolveUserId(manager);

    try {
      await prisma.lead.create({
        data: {
          name: oppName || company,
          email: `${company.toLowerCase().replace(/\s+/g, '.')}@client.local`,
          company,
          source: 'EMAIL',
          status,
          quoteNo,
          rfqDate,
          followUpDate,
          poReceivedDate: poDate,
          quoteValue,
          remarks,
          assignedToId,
          broughtById,
          qualificationNotes: remarks,
        }
      });
      created++;
    } catch (e) {
      console.error(`Failed row ${quoteNo}:`, e.message);
      skipped++;
    }
  }

  console.log(`\nImport complete: ${created} created, ${skipped} skipped`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
