// Migration to ensure all quotations linked to leads follow the lead's leadNumber
// scheme: QT-<year>-<seq>-<letter> (e.g. Lead LD-2026-0273 -> QT-2026-0273-A, QT-2026-0273-B).
const { PrismaClient } = require('@prisma/client');

function leadQuoteNumber(leadNumber, existingCount) {
  let base = leadNumber
    .replace(/^EO-LD-?/, 'QT-')
    .replace(/^EO-QT-?/, 'QT-')
    .replace(/^LD-?/, 'QT-')
    .replace(/^MOCK-?/, 'QT-');

  base = base.replace(/^QT-QT-?/, 'QT-');
  base = base.replace(/-[A-Za-z]+$/, '');
  if (!base.startsWith('QT-')) {
    base = `QT-${base.replace(/^[A-Za-z]+-/, '')}`;
  }

  let n = Math.max(0, existingCount);
  let suffix = '';
  do {
    suffix = String.fromCharCode(65 + (n % 26)) + suffix;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `${base}-${suffix}`;
}

async function migrateQuotationNumbers(existingPrisma) {
  const prisma = existingPrisma || new PrismaClient();
  const shouldDisconnect = !existingPrisma;

  try {
    const leads = await prisma.lead.findMany({
      where: {
        OR: [
          { leadNumber: { not: null } },
          { quoteNo: { not: null } },
        ],
      },
      select: { id: true, leadNumber: true, quoteNo: true },
    });

    let updatedCount = 0;
    for (const lead of leads) {
      const targetLeadNum = lead.leadNumber || lead.quoteNo;
      if (!targetLeadNum) continue;

      const quotes = await prisma.quotation.findMany({
        where: { leadId: lead.id },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true, quotationNumber: true },
      });

      if (!quotes.length) continue;

      // 1. Temporarily rename any quotes that need changing to avoid unique collisions
      for (let i = 0; i < quotes.length; i++) {
        const expectedNumber = leadQuoteNumber(targetLeadNum, i);
        if (quotes[i].quotationNumber !== expectedNumber) {
          await prisma.quotation.update({
            where: { id: quotes[i].id },
            data: { quotationNumber: `TEMP-QT-${quotes[i].id}` },
          });
        }
      }

      // 2. Set the expected lead-aligned quotation numbers
      for (let i = 0; i < quotes.length; i++) {
        const expectedNumber = leadQuoteNumber(targetLeadNum, i);
        if (quotes[i].quotationNumber !== expectedNumber) {
          await prisma.quotation.update({
            where: { id: quotes[i].id },
            data: { quotationNumber: expectedNumber },
          });
          console.log(`[migrate-quotations] Lead ${targetLeadNum}: ${quotes[i].quotationNumber} -> ${expectedNumber}`);
          updatedCount++;
        }
      }
    }

    console.log(`[migrate-quotations] Migration complete. Updated ${updatedCount} quotation(s).`);
  } catch (err) {
    console.error('[migrate-quotations] Error during migration:', err.message);
    throw err;
  } finally {
    if (shouldDisconnect) {
      await prisma.$disconnect();
    }
  }
}

if (require.main === module) {
  migrateQuotationNumbers().catch(() => process.exit(1));
}

module.exports = { migrateQuotationNumbers, leadQuoteNumber };
