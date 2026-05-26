const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

function parseDate(str) {
  if (!str || !str.trim()) return null;
  // Handle dot-separated dates like 05.05.2026
  const s = str.trim().replace(/\./g, '-');
  const parts = s.split('-');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    if (y.length === 4) {
      const date = new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`);
      if (!isNaN(date)) return date;
    }
  }
  return null;
}

function parseValue(str) {
  if (!str || !str.trim()) return null;
  // Take first number sequence, strip currency symbols and commas
  const cleaned = str.replace(/[₹,\s"]/g, '').split(/\s+/)[0];
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

function mapStatus(csvStatus) {
  const map = {
    'won':           'WON',
    'lost':          'LOST',
    'suspect':       'SUSPECT',
    'prospect':      'PROSPECT',
    'nego':          'NEGOTIATION',
    'negotiation':   'NEGOTIATION',
    'commit':        'NEGOTIATION',
    'dropped':       'DROPPED',
    'hold':          'ON_HOLD',
    'on hold':       'ON_HOLD',
    'price pending': 'SUSPECT',
  };
  return map[(csvStatus || '').toLowerCase().trim()] || 'SUSPECT';
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
  // Load real users
  const users = await prisma.user.findMany({ select: { id: true, firstName: true, email: true, role: true } });
  console.log('Real users:', users.map(u => `${u.firstName} (${u.role})`).join(', '));

  // Map CSV name fragments to real user IDs
  // CSV uses: Geetha, Srini, Hema, Krishnan, Jeevitha, Leo, Vaidy
  // Real users: Elizabeth Geetha (manager), Hema Priya (sales), Jeevitha (sales), Vaidyanathan (admin)
  const geetha    = users.find(u => u.firstName.toLowerCase().includes('elizabeth') || u.email.includes('elizabeth'));
  const hema      = users.find(u => u.firstName.toLowerCase().includes('hema'));
  const jeevitha  = users.find(u => u.firstName.toLowerCase().includes('jeevitha'));
  const vaidya    = users.find(u => u.firstName.toLowerCase().includes('vaidyanathan'));

  // Srini, Leo, Krishnan, Vaidy don't have real users — map to admin
  const nameMap = {
    'geetha':   geetha?.id   || vaidya.id,
    'srini':    vaidya.id,
    'hema':     hema?.id     || vaidya.id,
    'krishnan': vaidya.id,
    'jeevitha': jeevitha?.id || vaidya.id,
    'jeevi':    jeevitha?.id || vaidya.id,
    'jeevitha': jeevitha?.id || vaidya.id,
    'leo':      vaidya.id,
    'vaidy':    vaidya.id,
    'vady':     vaidya.id,
  };

  function resolveUser(name) {
    if (!name) return vaidya.id;
    const first = name.split('/')[0].trim().toLowerCase();
    return nameMap[first] || vaidya.id;
  }

  function resolveBroughtBy(name) {
    if (!name || !name.includes('/')) return null;
    const second = name.split('/')[1]?.trim().toLowerCase();
    if (!second) return null;
    return nameMap[second] || null;
  }

  const csvPath = path.join(__dirname, "../csv's/Leads..csv");
  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(content);
  console.log(`Parsed ${rows.length} rows`);

  let created = 0, skipped = 0;

  for (const row of rows) {
    const quoteNo   = row['S.NO']?.trim();
    const company   = row['Customer name']?.trim();
    const oppName   = row['Opp name']?.trim();
    const manager   = row['Account Manager']?.trim();
    const status    = mapStatus(row['Status']);
    const remarks   = row['Remarks']?.trim() || null;
    const rfqDate   = parseDate(row['RFQ Date']);
    const followUpDate = parseDate(row['Followup Date']);
    const poDate    = parseDate(row['PO Received Date']);
    const quoteValue = parseValue(row['Quote Value']);

    if (!quoteNo) { skipped++; continue; }

    const assignedToId = resolveUser(manager);
    const broughtById  = resolveBroughtBy(manager);

    try {
      await prisma.lead.create({
        data: {
          name:        oppName || company || quoteNo,
          email:       company ? `${company.toLowerCase().replace(/[^a-z0-9]/g, '.')}@client.local` : `${quoteNo.toLowerCase()}@client.local`,
          company:     company || 'Unknown',
          source:      'EMAIL',
          status,
          quoteNo,
          rfqDate:     rfqDate || null,
          followUpDate:followUpDate || null,
          poReceivedDate: poDate || null,
          quoteValue:  quoteValue || null,
          remarks:     remarks || null,
          qualificationNotes: remarks || null,
          assignedToId,
          ...(broughtById && { broughtById }),
        }
      });
      created++;
    } catch (e) {
      console.error(`Failed ${quoteNo}:`, e.message);
      skipped++;
    }
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped`);
  console.log('\nAssignment summary:');
  console.log(`  Geetha (Elizabeth): CSV "Geetha" rows`);
  console.log(`  Hema Priya:         CSV "Hema" rows`);
  console.log(`  Jeevitha:           CSV "Jeevitha/Jeevi" rows`);
  console.log(`  Vaidyanathan:       CSV "Srini/Leo/Krishnan/Vaidy" rows`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
