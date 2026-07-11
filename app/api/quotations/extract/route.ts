import { NextRequest, NextResponse } from 'next/server';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { withAuth, AuthUser } from '@/lib/middleware/auth';
import { ValidationError } from '@/lib/errors';
import { parseQuotationText, parseQuotationHtml, ParsedQuotation } from '@/lib/quotation-parser';

const EMPTY: ParsedQuotation = {
  items: [],
  terms: { priceValidity: '', taxDetails: '', warranty: '', amcPeriod: '', deliveryEstimate: '', paymentTerms: '', notes: '' },
  meta: { refNumber: '', quotationDate: '', customerName: '', printedGrandTotal: null, computedGrandTotal: 0 },
  warnings: [],
};

async function extractFromPdf(bytes: Uint8Array): Promise<ParsedQuotation> {
  let text = '';
  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText();
    text = result.text || '';
  } catch (err) {
    console.error('PDF text extraction failed:', err);
    throw new ValidationError('Could not read this PDF — it may be corrupted or password-protected.');
  } finally {
    await parser.destroy().catch(() => {});
  }
  // A scanned/image-only PDF yields little or no extractable text; the on-prem
  // parser does not OCR, so say so plainly rather than returning noise.
  if (text.replace(/\s/g, '').length < 20) {
    return {
      ...EMPTY,
      warnings: ['No readable text was found — this looks like a scanned or image-only PDF. Please enter the quotation manually.'],
    };
  }
  return parseQuotationText(text);
}

async function extractFromDocx(bytes: Uint8Array): Promise<ParsedQuotation> {
  const buffer = Buffer.from(bytes);
  let html = '';
  let text = '';
  try {
    // HTML keeps the item table structure; raw text is used for terms/meta.
    [html, text] = await Promise.all([
      mammoth.convertToHtml({ buffer }).then((r) => r.value),
      mammoth.extractRawText({ buffer }).then((r) => r.value),
    ]);
  } catch (err) {
    console.error('DOCX extraction failed:', err);
    throw new ValidationError('Could not read this Word file — it may be corrupted or an unsupported format.');
  }
  if (text.replace(/\s/g, '').length < 20) {
    return {
      ...EMPTY,
      warnings: ['No readable text was found in this Word file. Please enter the quotation manually.'],
    };
  }
  return parseQuotationHtml(html, text);
}

// Reads an uploaded quotation (PDF or Word .docx), extracts its contents on
// this server (nothing leaves the box), and returns structured line-items +
// terms for the "New Quotation" form to pre-fill. Advisory only — the user
// still reviews and saves through the normal create flow; see warnings[].
export const POST = withAuth(async (req: NextRequest, _user: AuthUser) => {
  const maxSize = Number(process.env.MAX_FILE_SIZE) || 52428800; // 50 MB default

  const form = await req.formData().catch(() => null);
  if (!form) throw new ValidationError('Expected a multipart form upload.');

  const file = form.get('file');
  if (!(file instanceof File)) throw new ValidationError('No file was uploaded.');

  const name = file.name.toLowerCase();
  const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf');
  const isDocx =
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx');

  if (name.endsWith('.doc') && !isDocx) {
    throw new ValidationError('Old .doc files are not supported — please save as .docx or PDF and try again.');
  }
  if (!isPdf && !isDocx) {
    throw new ValidationError('Only PDF or Word (.docx) files can be imported.');
  }
  if (file.size === 0) throw new ValidationError('The uploaded file is empty.');
  if (file.size > maxSize) {
    throw new ValidationError(`File is too large (max ${(maxSize / 1024 / 1024).toFixed(0)} MB).`);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const parsed = isPdf ? await extractFromPdf(bytes) : await extractFromDocx(bytes);
  return NextResponse.json(parsed);
});
