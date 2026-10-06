import fs from 'fs';
import path from 'path';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  ShadingType,
  BorderStyle,
  Header,
  Footer,
  ImageRun,
  VerticalAlign,
  HeightRule,
} from 'docx';

function formatOrdinalDate(dateInput: Date | string): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';
  const day = d.getDate();
  const year = d.getFullYear();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const month = monthNames[d.getMonth()];

  let suffix = 'th';
  if (day === 1 || day === 21 || day === 31) suffix = 'st';
  else if (day === 2 || day === 22) suffix = 'nd';
  else if (day === 3 || day === 23) suffix = 'rd';

  return `${day}${suffix} ${month} ${year}`;
}

function parseNumber(val: number | string | null | undefined): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const clean = String(val).replace(/[^0-9.-]+/g, '');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

function formatInr(val: number | string | null | undefined): string {
  const num = parseNumber(val);
  return '₹ ' + new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function getAssetBuffer(fileName: string): Buffer | null {
  try {
    const fullPath = path.join(process.cwd(), 'public/quotation-assets', fileName);
    if (fs.existsSync(fullPath)) {
      return fs.readFileSync(fullPath);
    }
  } catch (err) {
    console.error(`Error loading asset ${fileName}:`, err);
  }
  return null;
}

export interface QuotationDocxData {
  quotationNumber: string;
  issueDate: Date | string;
  expiryDate?: Date | string | null;
  customer?: {
    companyName?: string | null;
    city?: string | null;
    billingAddress?: any;
    shippingAddress?: any;
    state?: string | null;
  } | null;
  deal?: {
    dealName?: string | null;
  } | null;
  lead?: {
    name?: string | null;
    company?: string | null;
  } | null;
  items: any[] | string;
  subtotal: string | number;
  taxAmount?: string | number;
  discountAmount?: string | number;
  totalAmount: string | number;
  priceValidity?: string | null;
  taxDetails?: string | null;
  warranty?: string | null;
  amcPeriod?: string | null;
  deliveryEstimate?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
  createdBy?: {
    firstName?: string | null;
    lastName?: string | null;
    role?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
}

export async function generateQuotationDocx(data: QuotationDocxData): Promise<Buffer> {
  // Load asset buffers
  const logoBuf = getAssetBuffer('logo.png');
  const swirlBuf = getAssetBuffer('swirl.png');
  const badgesStripBuf = getAssetBuffer('badges_strip.png');
  const iso20000Buf = getAssetBuffer('iso_20000.png') || getAssetBuffer('iso_20000.jpg');
  const iso27001Buf = getAssetBuffer('iso_27001.png') || getAssetBuffer('iso_27001.jpg');
  const iso9001Buf = getAssetBuffer('iso_9001.png') || getAssetBuffer('iso_9001.jpg');
  const awardBuf = getAssetBuffer('achievers_award.png');
  const phoneIconBuf = getAssetBuffer('icon_phone.png');
  const webIconBuf = getAssetBuffer('icon_web.png');
  const pinIconBuf = getAssetBuffer('icon_pin.png');

  // Parse items safely
  let rawItems: any[] = [];
  if (Array.isArray(data.items)) {
    rawItems = data.items;
  } else if (typeof data.items === 'string') {
    try {
      rawItems = JSON.parse(data.items);
    } catch {
      rawItems = [];
    }
  }

  // Common border styles for clean tables
  const thinBorder = {
    style: BorderStyle.SINGLE,
    size: 4, // 0.5 pt
    color: '444444',
  };
  const tableBorders = {
    top: thinBorder,
    bottom: thinBorder,
    left: thinBorder,
    right: thinBorder,
    insideHorizontal: thinBorder,
    insideVertical: thinBorder,
  };
  const noBorder = {
    style: BorderStyle.NONE,
    size: 0,
    color: 'FFFFFF',
  };
  const noBorders = {
    top: noBorder,
    bottom: noBorder,
    left: noBorder,
    right: noBorder,
    insideHorizontal: noBorder,
    insideVertical: noBorder,
  };

  // Header Table (Full Logo left, Swirl + GSTIN right)
  const headerLeftChildren: (ImageRun | TextRun)[] = [];
  if (logoBuf) {
    headerLeftChildren.push(
      new ImageRun({
        data: logoBuf,
        transformation: { width: 195, height: 45 },
        type: 'png',
      })
    );
  } else {
    headerLeftChildren.push(
      new TextRun({ text: 'eOrbitor', bold: true, size: 28, color: '0066CC' })
    );
  }

  const headerRightChildren: (ImageRun | TextRun)[] = [];
  if (swirlBuf) {
    headerRightChildren.push(
      new ImageRun({
        data: swirlBuf,
        transformation: { width: 64, height: 44 },
        type: 'png',
      })
    );
  }

  // Header for page 1 (with GSTIN)
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 62, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: headerLeftChildren,
                spacing: { after: 20 },
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
          }),
          new TableCell({
            width: { size: 38, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: headerRightChildren,
                spacing: { after: 20 },
              }),
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'GSTIN No: 33AAFCE7440J1ZN',
                    bold: true,
                    size: 21, // ~10.5 pt
                    color: '111111',
                  }),
                ],
              }),
            ],
            verticalAlign: VerticalAlign.BOTTOM,
          }),
        ],
      }),
    ],
  });

  const headerDivider = new Paragraph({
    border: {
      bottom: {
        color: 'CCCCCC',
        size: 6,
        style: BorderStyle.SINGLE,
      },
    },
    spacing: { before: 40, after: 140 },
  });

  // Footer: 4 columns (Phone, Web, Address, Badges Strip)
  const footerBadgesChildren: (ImageRun | TextRun)[] = [];
  if (badgesStripBuf) {
    footerBadgesChildren.push(
      new ImageRun({
        data: badgesStripBuf,
        transformation: { width: 198, height: 42 },
        type: 'png',
      })
    );
  } else {
    // Fallback to individual badges
    if (iso20000Buf) footerBadgesChildren.push(new ImageRun({ data: iso20000Buf, transformation: { width: 38, height: 38 }, type: 'png' }));
    if (iso27001Buf) footerBadgesChildren.push(new ImageRun({ data: iso27001Buf, transformation: { width: 38, height: 38 }, type: 'png' }));
    if (iso9001Buf) footerBadgesChildren.push(new ImageRun({ data: iso9001Buf, transformation: { width: 38, height: 38 }, type: 'png' }));
    if (awardBuf) footerBadgesChildren.push(new ImageRun({ data: awardBuf, transformation: { width: 48, height: 38 }, type: 'png' }));
  }

  const footerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          // Phone
          new TableCell({
            width: { size: 18, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: phoneIconBuf
                  ? [new ImageRun({ data: phoneIconBuf, transformation: { width: 14, height: 14 }, type: 'png' })]
                  : [],
                spacing: { after: 15 },
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'Toll-Free', size: 15, bold: true, color: '222222' }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: '1800 208 4646', size: 15, color: '222222' }),
                ],
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
          }),
          // Web
          new TableCell({
            width: { size: 23, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: webIconBuf
                  ? [new ImageRun({ data: webIconBuf, transformation: { width: 14, height: 14 }, type: 'png' })]
                  : [],
                spacing: { after: 15 },
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'support@eorbitor.com', size: 15, color: '222222' }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'www.eorbitor.com', size: 15, color: '222222' }),
                ],
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
          }),
          // Address
          new TableCell({
            width: { size: 23, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: pinIconBuf
                  ? [new ImageRun({ data: pinIconBuf, transformation: { width: 14, height: 14 }, type: 'png' })]
                  : [],
                spacing: { after: 15 },
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: '19, First Main Rd,', size: 15, color: '222222' }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'Vengeeswarar Nagar,', size: 15, color: '222222' }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'Chennai 600026', size: 15, color: '222222' }),
                ],
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
          }),
          // Badges Strip
          new TableCell({
            width: { size: 36, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: footerBadgesChildren,
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
          }),
        ],
      }),
    ],
  });

  const footerDivider = new Paragraph({
    border: {
      top: {
        color: 'CCCCCC',
        size: 6,
        style: BorderStyle.SINGLE,
      },
    },
    spacing: { before: 180, after: 60 },
  });

  // Body content: Recipient, Subject, Salutation
  const formattedDate = formatOrdinalDate(data.issueDate);
  const refString = data.quotationNumber.startsWith('E-Orbitor')
    ? `Ref: ${data.quotationNumber}`
    : `Ref: E-Orbitor/26-27/${data.quotationNumber}`;

  const customerName = data.customer?.companyName || data.lead?.company || 'Customer';
  let customerCity = data.customer?.city || '';
  if (!customerCity && data.customer?.billingAddress) {
    if (typeof data.customer.billingAddress === 'object') {
      customerCity = data.customer.billingAddress.city || data.customer.billingAddress.state || '';
    } else if (typeof data.customer.billingAddress === 'string') {
      customerCity = data.customer.billingAddress.split(',').pop()?.trim() || '';
    }
  }
  if (!customerCity) customerCity = 'Chennai.';
  else if (!customerCity.endsWith('.')) customerCity = `${customerCity}.`;

  const subjectText = data.deal?.dealName
    ? `Quotation for ${data.deal.dealName}`
    : data.lead?.name
      ? `Quotation for ${data.lead.name}`
      : `Quotation for Products Requirement`;

  // Build Items Table
  const tableRows: TableRow[] = [];

  // Table Header Row (Bright Yellow background #FFFF00)
  tableRows.push(
    new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: [
        new TableCell({
          width: { size: 7, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: 'FFFF00' },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'S/n', bold: true, size: 18 })],
            }),
          ],
          verticalAlign: VerticalAlign.CENTER,
        }),
        new TableCell({
          width: { size: 55, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: 'FFFF00' },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'Product Name', bold: true, size: 18 })],
            }),
          ],
          verticalAlign: VerticalAlign.CENTER,
        }),
        new TableCell({
          width: { size: 8, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: 'FFFF00' },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'Qty', bold: true, size: 18 })],
            }),
          ],
          verticalAlign: VerticalAlign.CENTER,
        }),
        new TableCell({
          width: { size: 15, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: 'FFFF00' },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'Unit Price', bold: true, size: 18 })],
            }),
          ],
          verticalAlign: VerticalAlign.CENTER,
        }),
        new TableCell({
          width: { size: 15, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: 'FFFF00' },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'Total Price', bold: true, size: 18 })],
            }),
          ],
          verticalAlign: VerticalAlign.CENTER,
        }),
      ],
    })
  );

  // Body Rows
  rawItems.forEach((item, index) => {
    const sn = String(index + 1);
    const productName = item.productName || item.name || item.title || item.product?.name || `Item #${index + 1}`;
    const description = item.description && item.description !== productName ? item.description : '';
    const qty = parseFloat(item.quantity || item.qty || 1);
    const unitPrice = parseFloat(item.unitPrice || 0);
    const total = item.printedTotal ? parseFloat(item.printedTotal) : (item.total ? parseFloat(item.total) : qty * unitPrice);

    // Product cell paragraphs: bold name, then regular description
    const productCellParagraphs: Paragraph[] = [
      new Paragraph({
        children: [new TextRun({ text: productName, bold: true, size: 17 })],
        spacing: { after: 30 },
      }),
    ];

    if (description) {
      const descLines = description.split('\n');
      descLines.forEach((line: string) => {
        if (line.trim()) {
          productCellParagraphs.push(
            new Paragraph({
              children: [new TextRun({ text: line.trim(), size: 16, color: '333333' })],
              spacing: { after: 20 },
            })
          );
        }
      });
    }

    tableRows.push(
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 7, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: sn, bold: true, size: 18 })],
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
          }),
          new TableCell({
            width: { size: 55, type: WidthType.PERCENTAGE },
            children: productCellParagraphs,
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
          }),
          new TableCell({
            width: { size: 8, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: String(qty), size: 17 })],
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
          }),
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: formatInr(unitPrice), size: 17 })],
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
          }),
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: formatInr(total), size: 17 })],
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
          }),
        ],
      })
    );
  });

  // Grand Total Row (merged columns 1-4)
  tableRows.push(
    new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          columnSpan: 4,
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: 'Grand Total', bold: true, size: 18 })],
            }),
          ],
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
        }),
        new TableCell({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: formatInr(data.totalAmount), bold: true, size: 18 })],
            }),
          ],
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
        }),
      ],
    })
  );

  const productTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: tableRows,
  });

  // Terms & Conditions block
  const termsParagraphs: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: 'TERMS & CONDITIONS:', bold: true, size: 18 })],
      spacing: { before: 240, after: 80 },
    }),
  ];

  const termsList: string[] = [];
  if (data.priceValidity) termsList.push(`Validity: ${data.priceValidity}`);
  else termsList.push(`Validity: Till 30 days from quotation date`);

  if (data.paymentTerms) termsList.push(`Payment: ${data.paymentTerms}`);
  else termsList.push(`Payment: 30 days from the date of PO`);

  if (data.taxDetails) termsList.push(`Taxes: ${data.taxDetails}`);
  else termsList.push(`Taxes: EXTRA As Applicable.`);

  if (data.deliveryEstimate) {
    const lines = data.deliveryEstimate.split('\n').map(l => l.trim()).filter(Boolean);
    lines.forEach(l => {
      termsList.push(l.startsWith('Delivery:') || l.startsWith('Installation:') ? l : `Delivery: ${l}`);
    });
  } else {
    termsList.push(`Installation: Extra.`);
  }

  if (data.warranty) termsList.push(`Warranty: ${data.warranty}`);
  if (data.amcPeriod) termsList.push(`AMC: ${data.amcPeriod}`);

  termsList.forEach(t => {
    termsParagraphs.push(
      new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: t, size: 19 })],
        spacing: { after: 30 },
      })
    );
  });

  // Sign-off
  const creatorName = data.createdBy
    ? `${data.createdBy.firstName || ''} ${data.createdBy.lastName || ''}`.trim() || 'Authorised Signatory'
    : 'Authorised Signatory';
  const creatorRole = data.createdBy?.role
    ? data.createdBy.role.replace(/_/g, ' ')
    : 'Sr. Vice President-Business Group';
  const creatorPhone = data.createdBy?.phone ? `HP ${data.createdBy.phone}` : 'HP 956600106';

  const signoffParagraphs: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: 'Thanks, and Regards', bold: true, size: 21 })],
      spacing: { before: 200, after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: creatorName, bold: true, size: 21 })],
      spacing: { after: 30 },
    }),
    new Paragraph({
      children: [new TextRun({ text: creatorRole, bold: true, size: 21 })],
      spacing: { after: 30 },
    }),
    new Paragraph({
      children: [new TextRun({ text: creatorPhone, bold: true, size: 21 })],
      spacing: { after: 200 },
    }),
  ];

  // Document Assembly
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Calibri',
            size: 18, // 9pt
            color: '111111',
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 576,    // 0.4 in
              bottom: 576, // 0.4 in
              left: 720,   // 0.5 in
              right: 720,  // 0.5 in
            },
          },
        },
        children: [
          // Header Table (Full Logo left, Swirl + GSTIN right)
          headerTable,
          headerDivider,

          // Date & Reference
          new Paragraph({
            children: [new TextRun({ text: formattedDate, bold: true, size: 22 })],
            spacing: { before: 80, after: 40 },
          }),
          new Paragraph({
            children: [new TextRun({ text: refString, bold: true, size: 22 })],
            spacing: { after: 180 },
          }),

          // TO block
          new Paragraph({
            children: [new TextRun({ text: 'TO,', bold: true, size: 22 })],
            spacing: { after: 30 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `${customerName},`, bold: true, size: 22 })],
            spacing: { after: 30 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `${customerCity}`, bold: true, size: 22 })],
            spacing: { after: 200 },
          }),

          // Subject
          new Paragraph({
            children: [new TextRun({ text: `Sub: ${subjectText}`, bold: true, size: 22 })],
            spacing: { after: 180 },
          }),

          // Salutation
          new Paragraph({
            children: [new TextRun({ text: 'Dear Sir,', bold: true, size: 22 })],
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Please find herewith our quote for your requirement for your kind perusal.',
                size: 21,
              }),
            ],
            spacing: { after: 160 },
          }),

          // Products Table
          productTable,

          // Terms and Conditions
          ...termsParagraphs,

          // Sign-off
          ...signoffParagraphs,

          // Footer Divider & Footer Table (Toll-Free, Support, Address, Badges Strip)
          footerDivider,
          footerTable,
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
