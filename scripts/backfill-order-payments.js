/**
 * One-off migration for the order payment ledger.
 *
 * Before OrderPayment existed, an order carried a single `amountPaid` figure
 * plus one `paymentMode` / `paymentRemarks` / `paymentProofUrl`. This turns
 * each of those into a proper ledger row so the new Payment History panel
 * shows the money that was already collected instead of an empty list beside
 * a non-zero "Paid" total.
 *
 * It also moves any `paymentProofUrl` that is a base64 data URL out of
 * Postgres and onto disk via lib/storage, leaving only the file descriptor in
 * the database.
 *
 * Safe to re-run: orders that already have ledger rows are skipped.
 *
 *   node scripts/backfill-order-payments.js          # report only
 *   node scripts/backfill-order-payments.js --apply  # write changes
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

function uploadRoot() {
  const configured = process.env.FILE_UPLOAD_DIR;
  for (const dir of [configured, path.join(process.cwd(), 'uploads')].filter(Boolean)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch {
      /* try next */
    }
  }
  throw new Error('No writable upload directory. Set FILE_UPLOAD_DIR.');
}

/** "data:image/png;base64,AAAA" -> { contentType, buffer, ext } */
function parseDataUrl(value) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(value || '');
  if (!m) return null;
  const contentType = m[1] || 'application/octet-stream';
  const isBase64 = !!m[2];
  const buffer = isBase64
    ? Buffer.from(m[3], 'base64')
    : Buffer.from(decodeURIComponent(m[3]), 'utf8');
  const ext = (contentType.split('/')[1] || 'bin').split('+')[0].replace(/[^a-z0-9]/gi, '');
  return { contentType, buffer, ext };
}

(async () => {
  const orders = await prisma.order.findMany({
    where: { amountPaid: { gt: 0 } },
    select: {
      id: true,
      orderNumber: true,
      amountPaid: true,
      paymentMode: true,
      paymentRemarks: true,
      paymentProofUrl: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { payments: true } },
    },
  });

  const todo = orders.filter((o) => o._count.payments === 0);
  console.log(`orders with money recorded : ${orders.length}`);
  console.log(`already have ledger rows   : ${orders.length - todo.length}`);
  console.log(`to backfill                : ${todo.length}`);

  // Any user works as the recorder of record; prefer a super admin so the
  // synthetic row is obviously system-derived rather than blamed on a rep.
  const actor =
    (await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' }, select: { id: true } })) ||
    (await prisma.user.findFirst({ select: { id: true } }));
  if (!actor) {
    console.error('No users exist — cannot attribute the backfilled payments.');
    process.exit(1);
  }

  const root = APPLY ? uploadRoot() : null;
  let movedFiles = 0;
  let inlineBytes = 0;

  for (const o of todo) {
    let proof = null;
    const raw = o.paymentProofUrl;

    if (raw && raw.startsWith('data:')) {
      const parsed = parseDataUrl(raw);
      if (parsed) {
        inlineBytes += raw.length;
        if (APPLY) {
          const dir = path.join(root, 'orders', o.id);
          fs.mkdirSync(dir, { recursive: true });
          const id = crypto.randomUUID();
          const filename = `payment-proof.${parsed.ext}`;
          const rel = path.join('orders', o.id, `${id}.${parsed.ext}`);
          fs.writeFileSync(path.join(root, rel), parsed.buffer);
          proof = {
            id,
            filename,
            contentType: parsed.contentType,
            size: parsed.buffer.length,
            storagePath: rel,
            uploadedAt: new Date().toISOString(),
          };
        }
        movedFiles++;
      }
    } else if (raw) {
      // Already a plain URL — keep it as a reference rather than a stored file.
      proof = { externalUrl: raw, filename: 'Payment proof' };
    }

    if (!APPLY) continue;

    await prisma.$transaction([
      prisma.orderPayment.create({
        data: {
          orderId: o.id,
          amount: o.amountPaid.toString(),
          // No historical payment date was ever captured; updatedAt is the
          // closest honest approximation of when the money was recorded.
          paidAt: o.updatedAt || o.createdAt,
          mode: o.paymentMode || null,
          remarks: o.paymentRemarks
            ? `${o.paymentRemarks} (migrated from the order record)`
            : 'Migrated from the order record — date is approximate.',
          proof: proof || undefined,
          recordedById: actor.id,
        },
      }),
      // Clear the inlined blob now that the bytes live on disk.
      ...(raw && raw.startsWith('data:')
        ? [prisma.order.update({ where: { id: o.id }, data: { paymentProofUrl: null } })]
        : []),
    ]);
  }

  console.log(`\nbase64 proofs found        : ${movedFiles} (${(inlineBytes / 1024).toFixed(1)} KB inline)`);
  console.log(APPLY ? '\nAPPLIED.' : '\nDry run — re-run with --apply to write.');
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
