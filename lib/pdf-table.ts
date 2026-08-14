/**
 * Positional table extraction for quotation PDFs.
 *
 * Why this exists
 * ---------------
 * `pdf-parse`'s plain text output flattens a table *row by row across
 * columns*, so a row like
 *
 *     | 1 | Conference Room | OWL Labs Meeting Owl 3 | MEETING OWL 3- … | 20 | … |
 *
 * comes back as the lines "1 Conference", "Room", "OWL Labs", "Meeting Owl 3",
 * "MEETING OWL 3- The Meeting", … — the serial number welded onto the first
 * word of the category, and no way to tell which line belonged to which column.
 * The text parser therefore read the product name as "1 Conference".
 *
 * pdf.js gives every text run an (x, y), which is enough to rebuild the real
 * columns. This module does that and hands back one record per table row.
 *
 * It is deliberately advisory: `extractQuotationTable` returns `null` whenever
 * it cannot find a header it understands, and the caller falls back to the text
 * parser. Layouts it has never seen degrade to the old behaviour rather than
 * producing confidently wrong cells.
 */

export interface PositionalRow {
  serial?: string;
  category?: string;
  productName?: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  printedTotal: number;
}

interface Tok {
  str: string;
  x: number;
  y: number;
  page: number;
}

/** Column roles we know how to use, in the order they appear left-to-right. */
type Role = 'serial' | 'category' | 'productName' | 'description' | 'qty' | 'unitPrice' | 'total';

/**
 * Header labels, matched against adjacent tokens joined with all whitespace and
 * punctuation removed.
 *
 * Two things force this. PDF text runs split labels at arbitrary points — "Qty"
 * arrives as "Q" + "ty" — so a label has to be matched across a window of
 * neighbouring tokens, not token by token. And multi-word labels ("Unit Price")
 * may arrive either as one run or two. Longer windows are tried first so
 * "Total Price" is not consumed as "Total" plus a stray "Price".
 */
const HEADER_PATTERNS: { role: Role; re: RegExp }[] = [
  { role: 'serial', re: /^(s\.?no|s\/n|sl\.?no|sr\.?no|serial|#)$/ },
  { role: 'category', re: /^categor(y|ies)$/ },
  { role: 'productName', re: /^(productname|product|itemname|particulars|descriptionofgoods|nameofproduct)$/ },
  { role: 'description', re: /^(itemdescription|description|specification|specs|details|item)$/ },
  { role: 'qty', re: /^(qty|quantity|nos|units)$/ },
  { role: 'unitPrice', re: /^(unitprice|unitrate|rate|price|unitcost)$/ },
  { role: 'total', re: /^(totalprice|totalamount|total|amount|value)$/ },
];

/** Normalised form used for header matching. */
function headerKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9/.#]/g, '');
}

/**
 * Assign header tokens to column roles.
 *
 * Greedy longest-window-first over tokens sorted by x, so "Product" + "Name"
 * becomes one productName anchor rather than a productName and a stray match.
 */
function matchRoles(tokens: Tok[]): Map<Role, number> {
  const sorted = tokens.slice().sort((a, b) => a.x - b.x);
  const used = new Array(sorted.length).fill(false);
  const anchors = new Map<Role, number>();

  for (const width of [3, 2, 1]) {
    for (let i = 0; i + width <= sorted.length; i++) {
      if (used.slice(i, i + width).some(Boolean)) continue;
      const window = sorted.slice(i, i + width);
      // Tokens far apart horizontally are different columns, not one label.
      if (window[window.length - 1].x - window[0].x > 90) continue;
      const key = headerKey(window.map((t) => t.str).join(''));
      for (const { role, re } of HEADER_PATTERNS) {
        if (anchors.has(role) || !re.test(key)) continue;
        anchors.set(role, window[0].x);
        for (let k = i; k < i + width; k++) used[k] = true;
        break;
      }
    }
  }
  return anchors;
}

/** Money/number text as it survives PDF extraction ("₹ 1, 24 , 2 00 .00"). */
function parseNumeric(raw: string): number {
  // PDF text runs split numbers at arbitrary points, so strip everything that
  // is not a digit or a decimal point and reassemble.
  const cleaned = raw.replace(/[^\d.]/g, '');
  if (!cleaned) return NaN;
  // Guard against a stray second dot from adjacent runs being glued together.
  const firstDot = cleaned.indexOf('.');
  const normalised =
    firstDot === -1 ? cleaned : cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
  return parseFloat(normalised);
}

function joinTokens(toks: Tok[]): string {
  return toks
    .slice()
    .sort((a, b) => b.y - a.y || a.x - b.x)
    .map((t) => t.str)
    .join(' ')
    // PDF runs break mid-word ("omni" "-" "directional"), so pull hyphens and
    // punctuation back onto the preceding word.
    .replace(/\s+([,.\-:;)])/g, '$1')
    .replace(/([(\-])\s+/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Split points between columns.
 *
 * Taking the N-1 widest gaps in the data alone is not reliable: inside a
 * multi-word cell like "OWL Labs / Meeting Owl 3" the gap between two words can
 * exceed the gap that actually separates two columns. So each boundary is
 * searched for only between the two header labels it sits between — the header
 * says roughly where the seam is, and the data says exactly.
 */
function columnBoundaries(anchors: number[], dataXs: number[], lineStarts: number[]): number[] {
  const xs = [...new Set(dataXs)].sort((a, b) => a - b);
  // A column that wraps onto several lines begins each of them at the same x,
  // so a repeated line-start is a real cell edge. This is the deciding signal:
  // the widest gap alone is wrong whenever a cell's own word spacing ("OWL
  // Labs" → "Meeting Owl 3") exceeds the gap to the next column.
  const startCount = new Map<number, number>();
  for (const x of lineStarts) {
    const k = Math.round(x);
    startCount.set(k, (startCount.get(k) ?? 0) + 1);
  }
  const isCellEdge = (x: number) => (startCount.get(Math.round(x)) ?? 0) >= 2;

  const bounds: number[] = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    const lo = anchors[i];
    const hi = anchors[i + 1];
    let best = -1;
    let bestGap = -1;
    let edgeBest = -1;
    let edgeGap = -1;

    for (let j = 0; j < xs.length - 1; j++) {
      // The seam must fall between the two header labels. A cell's text can
      // start left of its own centred header, so allow a little slack.
      if (xs[j] < lo - 4 || xs[j + 1] > hi + 40) continue;
      const gap = xs[j + 1] - xs[j];
      const mid = (xs[j] + xs[j + 1]) / 2;
      if (gap > bestGap) {
        bestGap = gap;
        best = mid;
      }
      // Prefer a seam whose right-hand side is a confirmed cell edge.
      if (isCellEdge(xs[j + 1]) && gap > edgeGap) {
        edgeGap = gap;
        edgeBest = mid;
      }
    }

    const chosen = edgeBest >= 0 ? edgeBest : best;
    // No usable gap (an empty column, say) — fall back to the header midpoint.
    bounds.push(chosen >= 0 ? chosen : (lo + hi) / 2);
  }
  return bounds.sort((a, b) => a - b);
}

/**
 * Rebuild table rows from positioned text.
 *
 * `pages` is one array of tokens per page, already in reading order.
 */
export function rowsFromTokens(pages: Tok[][]): PositionalRow[] | null {
  const rows: PositionalRow[] = [];

  for (const toks of pages) {
    if (!toks.length) continue;

    // Group into visual lines so header labels that wrap ("Unit" / "Price")
    // can be matched together.
    const byLine = new Map<number, Tok[]>();
    for (const t of toks) {
      const key = Math.round(t.y * 2) / 2;
      if (!byLine.has(key)) byLine.set(key, []);
      byLine.get(key)!.push(t);
    }
    const lineYs = [...byLine.keys()].sort((a, b) => b - a);

    // The header is the topmost line carrying a quantity and a price label.
    // Compared without spaces because a label often arrives split ("Q" + "ty").
    let headerY: number | null = null;
    for (const y of lineYs) {
      const key = headerKey(byLine.get(y)!.map((t) => t.str).join(''));
      if (/qty|quantity/.test(key) && /price|rate|amount/.test(key)) {
        headerY = y;
        break;
      }
    }
    if (headerY === null) continue;

    // A header cell is centred on its own text, so a stacked label straddles
    // the main header line — "Product" can sit *above* it and "Name" below.
    // The window therefore reaches both ways.
    const headerToks = toks.filter((t) => t.y <= headerY + 14 && t.y > headerY - 15);
    const anchorByRole = matchRoles(headerToks);
    if (!anchorByRole.has('qty') || !anchorByRole.has('total')) continue;

    const kept = [...anchorByRole.entries()].sort((a, b) => a[1] - b[1]);
    if (kept.length < 3) continue;

    // Body starts below the lowest header token, not below the header line —
    // otherwise a wrapped label like "Name" is read as row content.
    const headerBottom = Math.min(...headerToks.map((t) => t.y));

    // Body = everything below the header, above the grand-total line.
    let stopY = -Infinity;
    for (const y of lineYs) {
      if (y >= headerY) continue;
      const text = byLine.get(y)!.map((t) => t.str).join(' ');
      if (/grand\s*total|sub\s*total/i.test(text)) {
        stopY = y;
        break;
      }
    }
    const body = toks.filter((t) => t.y < headerBottom - 3 && t.y > stopY + 3);
    if (!body.length) continue;

    // Left-most token of each visual line in the body — the cell-edge evidence.
    const bodyLines = new Map<number, Tok[]>();
    for (const t of body) {
      const k = Math.round(t.y * 2) / 2;
      if (!bodyLines.has(k)) bodyLines.set(k, []);
      bodyLines.get(k)!.push(t);
    }
    const lineStarts = [...bodyLines.values()].map((ts) => Math.min(...ts.map((t) => t.x)));

    const bounds = columnBoundaries(kept.map((k) => k[1]), body.map((t) => t.x), lineStarts);
    const colOf = (x: number) => {
      let c = 0;
      while (c < bounds.length && x >= bounds[c]) c++;
      return c;
    };
    const roleOf = (col: number): Role | undefined => kept[col]?.[0];

    // Each row carries exactly one printed total; its y marks the row.
    const totalCol = kept.findIndex((k) => k[0] === 'total');
    const markers = [
      ...new Set(
        body
          .filter((t) => colOf(t.x) === totalCol && /\d/.test(t.str))
          .map((t) => Math.round(t.y))
      ),
    ].sort((a, b) => b - a);
    if (!markers.length) continue;

    for (let i = 0; i < markers.length; i++) {
      // A row owns the band from halfway to the row above down to halfway to
      // the row below, since a tall description cell is centred on its total.
      const upper = i === 0 ? Infinity : (markers[i - 1] + markers[i]) / 2;
      const lower = i === markers.length - 1 ? -Infinity : (markers[i] + markers[i + 1]) / 2;
      const cells = new Map<Role, Tok[]>();
      for (const t of body) {
        if (t.y > upper || t.y <= lower) continue;
        const role = roleOf(colOf(t.x));
        if (!role) continue;
        if (!cells.has(role)) cells.set(role, []);
        cells.get(role)!.push(t);
      }

      const qty = parseNumeric(joinTokens(cells.get('qty') ?? []));
      const unitPrice = parseNumeric(joinTokens(cells.get('unitPrice') ?? []));
      const printedTotal = parseNumeric(joinTokens(cells.get('total') ?? []));
      if (!Number.isFinite(qty) || !Number.isFinite(unitPrice) || !Number.isFinite(printedTotal)) continue;
      if (qty <= 0 || unitPrice <= 0 || printedTotal < unitPrice) continue;

      rows.push({
        serial: joinTokens(cells.get('serial') ?? []) || undefined,
        category: joinTokens(cells.get('category') ?? []) || undefined,
        productName: joinTokens(cells.get('productName') ?? []) || undefined,
        description: joinTokens(cells.get('description') ?? []) || undefined,
        quantity: qty,
        unitPrice,
        printedTotal,
      });
    }
  }

  if (!rows.length) return null;

  // Safety gate.
  //
  // Column reconstruction is a geometric guess, and a wrong guess is worse than
  // no guess: it yields a confident, plausible-looking row with the wrong
  // numbers. Every row therefore has to prove itself arithmetically — quantity
  // times unit price must equal the printed total. When two rows' cells are
  // merged (their qty digits concatenating to "152", say) that identity breaks,
  // and the whole result is discarded so the caller falls back to the text
  // parser rather than importing nonsense.
  const consistent = rows.every(
    (r) => Math.abs(r.quantity * r.unitPrice - r.printedTotal) <= Math.max(1, r.printedTotal * 0.005)
  );
  if (!consistent) return null;

  return rows;
}

/** Read a PDF's quotation table positionally. Returns null if unsupported. */
export async function extractQuotationTable(bytes: Uint8Array): Promise<PositionalRow[] | null> {
  try {
    // Imported lazily and by path: the legacy build is the one that runs under
    // Node without a DOM, and a static import would pull it into every bundle
    // that touches this module.
    const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({ data: bytes, useSystemFonts: true, isEvalSupported: false }).promise;
    const pages: Tok[][] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      pages.push(
        content.items
          .filter((i: any) => typeof i.str === 'string' && i.str.trim())
          .map((i: any) => ({ str: i.str, x: i.transform[4], y: i.transform[5], page: p }))
      );
    }
    await doc.destroy().catch(() => {});
    return rowsFromTokens(pages);
  } catch (err) {
    // Positional extraction is an enhancement; never let it fail the import.
    console.error('Positional table extraction failed, falling back to text:', err);
    return null;
  }
}
