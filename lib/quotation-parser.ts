// ─────────────────────────────────────────────────────────────────────────────
// On-premise quotation PDF parser
//
// Turns the plain text of an eOrbitor quotation PDF (as produced by
// pdf-parse's getText()) into the structured shape the "New Quotation" form
// expects — line items + terms. Runs entirely on our own server; no data
// ever leaves the box.
//
// It is deliberately a *heuristic* parser tuned to the company's letterhead
// template, and it never trusts itself blindly: every figure it pulls out is
// cross-checked (qty × unit price vs the printed line total; Σ line totals vs
// the printed grand total) and any discrepancy is surfaced as a warning so
// the person importing knows exactly which cell to double-check before saving.
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedLineItem {
  productName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;      // Quotations are raised tax-exclusive — GST is never charged on the quote
  printedTotal: number; // the "Total Price" as it appears in the PDF
}

export interface ParsedTerms {
  priceValidity: string;
  taxDetails: string;
  warranty: string;
  amcPeriod: string;
  deliveryEstimate: string;
  paymentTerms: string;
  notes: string;
}

export interface ParsedQuotation {
  items: ParsedLineItem[];
  terms: ParsedTerms;
  meta: {
    refNumber: string;
    quotationDate: string;
    customerName: string;
    printedGrandTotal: number | null;
    computedGrandTotal: number;
  };
  warnings: string[];
}

// Boilerplate that pdf-parse interleaves between pages (letterhead, footer,
// page joiner). These lines must never leak into a product's description.
const NOISE = [
  /^-{2,}.*\bof\b.*-{2,}$/i,                 // "-- 1 of 2 --" page joiner
  /vengeeswarar|first\s+main\s+rd/i,
  /chennai\s*600026/i,
  /toll[-\s]?free/i,
  /1800\s*208\s*4646/i,
  /support@eorbitor|www\.eorbitor/i,
  /gstin\s*no/i,
  /technology for better tomorrow/i,
  /^tm$/i,
];

function isNoise(line: string): boolean {
  return NOISE.some((re) => re.test(line));
}

// "₹ 2,39,413.00" / "Rs. 1,53,882" / "35,91,195.00" → 239413 etc.
// Indian digit grouping (2,39,413) is handled by simply dropping all commas.
function parseAmount(raw: string): number {
  const n = parseFloat(raw.replace(/[^\d.]/g, ''));
  return isNaN(n) ? 0 : n;
}

// A table value row: "<qty>  ₹<unit price>  ₹<total>".
// The currency separator is treated as "any run of non-digits" so it survives
// ₹ being extracted as ?, Rs., INR, or dropped entirely by the PDF font.
const MONEY = String.raw`([\d][\d,]*(?:\.\d{1,2})?)`;
const VALUE_LINE = new RegExp(`^\\s*(\\d{1,6})\\s*\\D+?${MONEY}\\s+\\D*?${MONEY}\\s*$`);

// A real money token in this template is always grouped or has decimals —
// requiring that rules out spec lines like "16GB DDR5, 2x8GB 1TB" matching.
function looksLikeMoney(s: string): boolean {
  return /[.,]/.test(s);
}

interface RawItem {
  nameLines: string[];
  quantity: number;
  unitPrice: number;
  printedTotal: number;
}

// Pulls the product rows out of the table region (between the column header
// and "Grand Total"). Each item is a block of name/description lines that ends
// with a value row; the leading standalone serial number both delimits a new
// item and lets us discard any page-break boilerplate that preceded it.
function extractRawItems(lines: string[]): RawItem[] {
  const headerIdx = lines.findIndex(
    (l) => /product\s*name/i.test(l) || (/unit\s*price/i.test(l) && /qty/i.test(l))
  );
  const grandIdx = lines.findIndex((l) => /grand\s*total/i.test(l));

  const start = headerIdx >= 0 ? headerIdx + 1 : 0;
  const end = grandIdx >= 0 ? grandIdx : lines.length;

  const items: RawItem[] = [];
  let buffer: string[] = [];

  for (let i = start; i < end; i++) {
    const line = lines[i].trim();
    if (!line || isNoise(line)) continue;

    // A standalone serial number ("1", "2", …) starts a fresh item — reset the
    // buffer so any footer/header text from a page break is thrown away.
    if (/^\d{1,3}$/.test(line)) {
      buffer = [];
      continue;
    }

    const m = line.match(VALUE_LINE);
    if (m && looksLikeMoney(m[2]) && looksLikeMoney(m[3])) {
      const quantity = parseInt(m[1], 10);
      const unitPrice = parseAmount(m[2]);
      const printedTotal = parseAmount(m[3]);
      // Sanity: a genuine row has a positive qty and a total ≥ the unit price.
      if (quantity > 0 && unitPrice > 0 && printedTotal >= unitPrice) {
        items.push({ nameLines: [...buffer], quantity, unitPrice, printedTotal });
        buffer = [];
        continue;
      }
    }
    buffer.push(line);
  }

  return items;
}

// First line of the block is the product title; if it carries a "Model : spec"
// colon, keep the model as the name and fold the spec into the description.
function splitNameAndDescription(nameLines: string[]): { productName: string; description: string } {
  const cleaned = nameLines.map((l) => l.trim()).filter(Boolean);
  if (cleaned.length === 0) return { productName: '', description: '' };

  const first = cleaned[0];
  const rest = cleaned.slice(1);
  const colon = first.indexOf(':');

  let productName: string;
  let descParts: string[];
  if (colon > 0 && colon < first.length - 1) {
    productName = first.slice(0, colon).trim();
    descParts = [first.slice(colon + 1).trim(), ...rest];
  } else {
    productName = first;
    descParts = rest;
  }

  const description = descParts.join(' ').replace(/\s{2,}/g, ' ').trim();
  return { productName, description };
}

function sliceLine(text: string, re: RegExp): string {
  const m = text.match(re);
  return m ? m[1].trim().replace(/\s{2,}/g, ' ') : '';
}

function parseTerms(lines: string[], fullText: string): ParsedTerms {
  const tcIdx = lines.findIndex((l) => /terms\s*&?\s*conditions/i.test(l));
  const endIdx = lines.findIndex((l, i) => i > tcIdx && /thanks|regards/i.test(l));
  const tcLines =
    tcIdx >= 0 ? lines.slice(tcIdx + 1, endIdx > tcIdx ? endIdx : undefined) : [];

  let priceValidity = '';
  let paymentTerms = '';
  let taxDetails = '';
  const deliveryParts: string[] = [];
  const otherNotes: string[] = [];

  for (const raw of tcLines) {
    // Strip a leading bullet / dash so keyword matching is clean.
    const line = raw.replace(/^[•\-*•\s]+/, '').trim();
    if (!line || isNoise(line)) continue;

    if (/validity/i.test(line)) {
      priceValidity = sliceLine(line, /validity[:\-\s]*(.+)/i) || line;
    } else if (/payment/i.test(line)) {
      paymentTerms = sliceLine(line, /payment[:\-\s]*(.+)/i) || line;
    } else if (/tax/i.test(line)) {
      taxDetails = sliceLine(line, /tax(?:es)?[:\-\s]*(.+)/i) || line;
    } else if (/\b(weeks?|days?)\b/i.test(line) || /\bunits?\b/i.test(line)) {
      // Per-model delivery timelines ("… 15 units 6-8 weeks").
      deliveryParts.push(line);
    } else if (/installation/i.test(line)) {
      otherNotes.push(line);
    } else {
      otherNotes.push(line);
    }
  }

  // Warranty lives inside the product descriptions, not the T&C block
  // (e.g. "3 Yrs Onsite warranty"). Pull the first such mention and normalise
  // out the line break and any trailing Dell SKU ("…-DLMOWM0043").
  const warranty = sliceLine(fullText, /(\d+\s*(?:yr|yrs|years?)\s+onsite(?:\s+warranty)?)/i)
    .replace(/\s+/g, ' ')
    .trim();

  return {
    priceValidity,
    taxDetails,
    warranty,
    amcPeriod: '',
    deliveryEstimate: deliveryParts.join('; '),
    paymentTerms,
    notes: otherNotes.join(' · '),
  };
}

function parseMeta(lines: string[], fullText: string) {
  const refNumber = sliceLine(fullText, /ref[:\s]+(\S+)/i);

  const quotationDate =
    sliceLine(fullText, /(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4})/) ||
    sliceLine(fullText, /(\d{1,2}[-/]\d{1,2}[-/]\d{4})/);

  // The recipient is the first meaningful line after "TO,".
  let customerName = '';
  const toIdx = lines.findIndex((l) => /^to[,:]?$/i.test(l.trim()));
  if (toIdx >= 0) {
    for (let i = toIdx + 1; i < lines.length; i++) {
      const l = lines[i].trim();
      if (!l || isNoise(l)) continue;
      customerName = l.replace(/[,]+$/, '');
      break;
    }
  }

  return { refNumber, quotationDate, customerName };
}

function finalizeQuotation(rawItems: RawItem[], rawText: string): ParsedQuotation {
  const compact = rawText.split(/\r?\n/).map((l) => l.replace(/\u00A0/g, ' ').trim());

  const warnings: string[] = [];
  const items: ParsedLineItem[] = rawItems.map((ri, idx) => {
    const { productName, description } = splitNameAndDescription(ri.nameLines);
    const computed = ri.quantity * ri.unitPrice;
    // Flag a row where qty × unit price disagrees with the printed total by
    // more than a rounding-sized margin — that's the person's cue to verify.
    if (Math.abs(computed - ri.printedTotal) > Math.max(1, ri.printedTotal * 0.01)) {
      warnings.push(
        `Row ${idx + 1} (${productName || 'unnamed'}): qty × unit price = ${computed.toLocaleString(
          'en-IN'
        )} but the document shows ${ri.printedTotal.toLocaleString('en-IN')}. Please verify.`
      );
    }
    if (!productName) {
      warnings.push(`Row ${idx + 1}: product name couldn't be read — please fill it in.`);
    }
    return {
      productName,
      description,
      quantity: ri.quantity,
      unitPrice: ri.unitPrice,
      taxRate: 0,
      printedTotal: ri.printedTotal,
    };
  });

  const terms = parseTerms(compact, rawText);
  const meta = parseMeta(compact, rawText);

  const computedGrandTotal = items.reduce((s, i) => s + i.printedTotal, 0);
  const printedGrandTotal = (() => {
    // Match across newlines: PDF puts the label + amount on one line, but Word
    // (via mammoth) flattens the total row's cells onto separate lines, so the
    // amount can sit several blank lines below the "Grand Total" label.
    const m = rawText.match(/grand\s*total[^\d]*([\d][\d,]*(?:\.\d{1,2})?)/i);
    if (!m) return null;
    const amt = parseAmount(m[1]);
    return amt > 0 ? amt : null;
  })();

  if (items.length === 0) {
    warnings.push(
      'No line items were detected — this document may not match the standard template. Please enter the items manually.'
    );
  }
  if (
    printedGrandTotal !== null &&
    Math.abs(printedGrandTotal - computedGrandTotal) > Math.max(1, printedGrandTotal * 0.01)
  ) {
    warnings.push(
      `The line items add up to ₹${computedGrandTotal.toLocaleString(
        'en-IN'
      )} but the document's Grand Total is ₹${printedGrandTotal.toLocaleString(
        'en-IN'
      )}. A row may be missing or misread.`
    );
  }

  return {
    items,
    terms,
    meta: { ...meta, printedGrandTotal, computedGrandTotal },
    warnings,
  };
}

// PDF path: text is extracted line-by-line, so line items are recovered with
// the value-row heuristic (see extractRawItems).
export function parseQuotationText(rawText: string): ParsedQuotation {
  const compact = rawText.split(/\r?\n/).map((l) => l.replace(/ /g, ' ').trim());
  return finalizeQuotation(extractRawItems(compact), rawText);
}

// ─── Word (.docx) support ─────────────────────────────────────────────────────
// Word quotations keep their line items in a real table, so mammoth's HTML
// (which preserves <table>/<tr>/<td>) gives cleaner structure than flat text.
// We read the item rows straight from the table cells, and still take the
// terms/meta/grand-total from the document's raw text via the shared tail.

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

// Cell text with paragraph/line breaks preserved as newlines, so a multi-line
// product cell still splits into name + description downstream.
function cellText(cellHtml: string): string {
  return decodeEntities(
    cellHtml
      .replace(/<\/(p|br|div)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

// A money cell reads as grouped/decimal digits with a meaningful value; this
// keeps a bare qty ("15") from being mistaken for an amount.
function isMoneyCell(text: string): boolean {
  return /\d[\d,]*[.,]\d|\d,\d/.test(text) && parseAmount(text) > 0;
}

// Map one table row's cells to a line item by *shape*, not fixed positions, so
// minor column-order differences between templates still parse: the last two
// money cells are unit price and total, the nearest bare integer before them is
// the quantity, and the most text-heavy cell is the product.
function rowToRawItem(cells: string[]): RawItem | null {
  const moneyIdx = cells.map((c, i) => (isMoneyCell(c) ? i : -1)).filter((i) => i >= 0);
  if (moneyIdx.length < 2) return null;

  const totalIdx = moneyIdx[moneyIdx.length - 1];
  const unitIdx = moneyIdx[moneyIdx.length - 2];
  const unitPrice = parseAmount(cells[unitIdx]);
  const printedTotal = parseAmount(cells[totalIdx]);

  let quantity = 0;
  for (let i = unitIdx - 1; i >= 0; i--) {
    if (/^\d{1,6}$/.test(cells[i].trim())) {
      quantity = parseInt(cells[i].trim(), 10);
      break;
    }
  }
  if (quantity <= 0 || unitPrice <= 0 || printedTotal < unitPrice) return null;

  let productCell = '';
  let mostLetters = -1;
  cells.forEach((c, i) => {
    if (i === totalIdx || i === unitIdx) return;
    const letters = (c.match(/[A-Za-z]/g) || []).length;
    if (letters > mostLetters) {
      mostLetters = letters;
      productCell = c;
    }
  });

  const nameLines = productCell.split('\n').map((s) => s.trim()).filter(Boolean);
  return { nameLines, quantity, unitPrice, printedTotal };
}

function extractRawItemsFromHtml(html: string): RawItem[] {
  const items: RawItem[] = [];
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  for (const table of tables) {
    const rows = table.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    for (const row of rows) {
      const cells = (row.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || []).map(cellText);
      if (cells.length < 3) continue;
      const item = rowToRawItem(cells);
      if (item) items.push(item);
    }
  }
  return items;
}

// Word path: `html` from mammoth.convertToHtml (for the item table) and
// `rawText` from mammoth.extractRawText (for terms/meta/grand total).
export function parseQuotationHtml(html: string, rawText: string): ParsedQuotation {
  return finalizeQuotation(extractRawItemsFromHtml(html), rawText);
}
