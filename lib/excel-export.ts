import ExcelJS from 'exceljs';

// ─── Palette ────────────────────────────────────────────────────────────────

const BANNER_BG = { argb: 'FF1F2937' };     // Charcoal Slate Navy — title banner
const SECTION_BG = { argb: 'FF374151' };    // Dark Slate — section headers
const TABLE_HEAD_BG = { argb: 'FF4B5563' }; // Medium Dark Grey — table headers
const ZEBRA_BG = { argb: 'FFF9FAFB' };      // Very light grey zebra stripe
const WHITE_BG = { argb: 'FFFFFFFF' };
const WHITE_TEXT = { argb: 'FFFFFFFF' };
const MUTED_TEXT = { argb: 'FF6B7280' };
const DARK_TEXT = { argb: 'FF111827' };
const GREEN_TEXT = { argb: 'FF15803D' };
const GREEN_BG = { argb: 'FFDCFCE7' };
const RED_TEXT = { argb: 'FFDC2626' };
const RED_BG = { argb: 'FFFEE2E2' };
const AMBER_BG = { argb: 'FFFEF3C7' };
const AMBER_TEXT = { argb: 'FF92400E' };
const BLUE_BG = { argb: 'FFDBEAFE' };
const BLUE_TEXT = { argb: 'FF1D4ED8' };
const BORDER = { style: 'thin' as const, color: { argb: 'FFE5E7EB' } };
const THIN_BORDER = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };

const CURRENCY_FMT = '"₹" #,##0';
const PERCENT_FMT = '0.0"%"';

type Row = (string | number)[];

interface TableOptions {
  currencyCols?: number[];
  percentCols?: number[];
  boldCols?: number[];
  alignLeftCols?: number[];
  alignCenterCols?: number[];
  colorCol?: { index: number; resolver: (val: any) => { argb: string } | null };
  statusCol?: { index: number; resolver: (val: any) => { bg: { argb: string }; text: { argb: string } } | null };
  rowBg?: (rowIndex: number) => { argb: string };
}

function bannerTitle(sheet: ExcelJS.Worksheet, title: string, subtitle: string, span: number) {
  const titleRow = sheet.addRow([title]);
  sheet.mergeCells(titleRow.number, 1, titleRow.number, span);
  titleRow.height = 28;
  titleRow.getCell(1).font = { bold: true, size: 14, color: WHITE_TEXT, name: 'Calibri' };
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: BANNER_BG };
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  const subRow = sheet.addRow([subtitle]);
  sheet.mergeCells(subRow.number, 1, subRow.number, span);
  subRow.height = 20;
  subRow.getCell(1).font = { size: 10, color: WHITE_TEXT, italic: true, name: 'Calibri' };
  subRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: SECTION_BG };
  subRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  sheet.addRow([]);
}

function sectionHeader(sheet: ExcelJS.Worksheet, label: string, span: number) {
  const row = sheet.addRow([label]);
  sheet.mergeCells(row.number, 1, row.number, span);
  row.height = 22;
  row.getCell(1).font = { bold: true, size: 11, color: WHITE_TEXT, name: 'Calibri' };
  row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: SECTION_BG };
  row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  return row;
}

function addTable(
  sheet: ExcelJS.Worksheet,
  title: string,
  headers: string[],
  rows: Row[],
  opts: TableOptions = {},
) {
  const span = headers.length;
  sectionHeader(sheet, title, span);

  const headerRow = sheet.addRow(headers);
  headerRow.height = 22;
  headerRow.eachCell((cell, colNum) => {
    cell.font = { bold: true, size: 10, color: WHITE_TEXT, name: 'Calibri' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: TABLE_HEAD_BG };
    cell.border = THIN_BORDER;
    cell.alignment = { vertical: 'middle', horizontal: colNum === 1 ? 'left' : 'right' };
  });

  rows.forEach((r, i) => {
    const dataRow = sheet.addRow(r);
    dataRow.height = 20;
    const bg = opts.rowBg ? opts.rowBg(i) : i % 2 === 0 ? WHITE_BG : ZEBRA_BG;
    dataRow.eachCell((cell, colNum) => {
      const colIdx = colNum - 1;
      cell.border = THIN_BORDER;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: bg };
      cell.font = { size: 10, color: DARK_TEXT, bold: opts.boldCols?.includes(colIdx), name: 'Calibri' };
      
      let horizAlign: 'left' | 'center' | 'right' = typeof r[colIdx] === 'number' ? 'right' : 'left';
      if (opts.alignLeftCols?.includes(colIdx)) horizAlign = 'left';
      if (opts.alignCenterCols?.includes(colIdx)) horizAlign = 'center';
      if (colIdx === 0 && horizAlign === 'left') horizAlign = 'left';

      cell.alignment = { vertical: 'middle', horizontal: horizAlign, indent: horizAlign === 'left' ? 1 : 0 };

      if (opts.currencyCols?.includes(colIdx)) cell.numFmt = CURRENCY_FMT;
      if (opts.percentCols?.includes(colIdx)) cell.numFmt = PERCENT_FMT;

      if (opts.colorCol && colIdx === opts.colorCol.index) {
        const color = opts.colorCol.resolver(r[colIdx]);
        if (color) cell.font = { ...cell.font, color, bold: true };
      }
      if (opts.statusCol && colIdx === opts.statusCol.index) {
        const style = opts.statusCol.resolver(r[colIdx]);
        if (style) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: style.bg };
          cell.font = { size: 10, bold: true, color: style.text, name: 'Calibri' };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      }
    });
  });

  sheet.addRow([]);
  return rows.length;
}

function addKpiBlock(
  sheet: ExcelJS.Worksheet,
  title: string,
  kpis: { label: string; value: string | number; fmt?: 'currency' | 'percent' }[],
  span: number,
) {
  sectionHeader(sheet, title, span);
  kpis.forEach((kpi, i) => {
    const row = sheet.addRow([kpi.label, kpi.value]);
    row.height = 20;
    const bg = i % 2 === 0 ? WHITE_BG : ZEBRA_BG;
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: bg };
    row.getCell(1).font = { size: 10, color: DARK_TEXT, name: 'Calibri' };
    row.getCell(1).border = THIN_BORDER;
    row.getCell(1).alignment = { vertical: 'middle', indent: 1 };

    row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: bg };
    row.getCell(2).font = { size: 11, bold: true, color: BANNER_BG, name: 'Calibri' };
    row.getCell(2).border = THIN_BORDER;
    row.getCell(2).alignment = { vertical: 'middle', horizontal: 'right' };
    if (kpi.fmt === 'currency') row.getCell(2).numFmt = CURRENCY_FMT;
    if (kpi.fmt === 'percent') row.getCell(2).numFmt = PERCENT_FMT;

    for (let c = 3; c <= span; c++) {
      sheet.getCell(row.number, c).fill = { type: 'pattern', pattern: 'solid', fgColor: bg };
      sheet.getCell(row.number, c).border = THIN_BORDER;
    }
  });
  sheet.addRow([]);
}

const ACTIVITY_MODE_LABELS: Record<string, string> = {
  MEETING: 'Meeting', CALL: 'Call', SITE_VISIT: 'Site Visit', DEMO: 'Demo',
  PROPOSAL: 'Proposal', NEGOTIATION: 'Negotiation', FOLLOW_UP: 'Follow-up',
  EMAIL: 'Email', WORK: 'Internal Work', TRAINING: 'Training', OTHER: 'Other',
};

const STATUS_STYLE: Record<string, { bg: { argb: string }; text: { argb: string } }> = {
  WON: { bg: GREEN_BG, text: GREEN_TEXT },
  ORDER: { bg: BLUE_BG, text: BLUE_TEXT },
  LOST: { bg: RED_BG, text: RED_TEXT },
  DROPPED: { bg: AMBER_BG, text: AMBER_TEXT },
};

export interface PersonalReportInput {
  user: { id: string; name: string; email: string; role: string };
  period: { startDate: string; endDate: string; days: number };
  metrics: any;
  topDeals: { id: string; dealName: string; value: number; closedDate: string; status: string }[];
}

export async function generatePersonalReportExcel(report: PersonalReportInput): Promise<Buffer> {
  const { user, period, metrics, topDeals } = report;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'eOrbitor Pulse';
  workbook.created = new Date();

  const periodLabel = `${new Date(period.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} – ${new Date(period.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}  (${period.days} days)`;

  // ─── 1. Executive Summary Sheet ──────────────────────────────────────────
  const da0 = metrics.dailyActivity;
  const summary = workbook.addWorksheet('Summary', {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
    views: [{ showGridLines: true, state: 'frozen', ySplit: 4 }],
  });
  summary.columns = [
    { width: 28 }, { width: 20 }, { width: 18 }, { width: 18 },
    { width: 18 }, { width: 32 }, { width: 14 },
  ];

  bannerTitle(summary, `Personal Performance Report — ${user.name}`, `${user.role.replace(/_/g, ' ')} · ${user.email} · ${periodLabel}`, 7);

  addKpiBlock(summary, 'Key Metrics Overview', [
    { label: 'Total Leads', value: metrics.leads.total },
    { label: 'Converted Leads', value: metrics.leads.converted },
    { label: 'Win Rate', value: metrics.conversion.winRate, fmt: 'percent' },
    { label: 'Conversion Rate', value: metrics.conversion.conversionRate, fmt: 'percent' },
    { label: 'Total Revenue', value: metrics.revenue.total, fmt: 'currency' },
    { label: 'Pipeline Value', value: metrics.revenue.pipeline, fmt: 'currency' },
    { label: 'Average Deal Value', value: metrics.revenue.average, fmt: 'currency' },
    { label: 'Activities Logged', value: metrics.activities.total },
    { label: 'Follow-ups Completed', value: metrics.activities.followupsCompleted },
    { label: 'Tasks Completed', value: metrics.activities.tasksCompleted },
    ...(da0 ? [
      { label: 'Days Present', value: da0.daysPresent },
      { label: 'Total Logged Hours', value: da0.totalLoggedHours },
    ] : []),
  ], 7);

  if (da0?.dailyBreakdown?.length > 0) {
    const hmSum = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—');
    addTable(summary, 'Daily Attendance Summary', ['Date', 'First Login', 'Last Logout', 'Logged Hours', 'Activities Logged'],
      da0.dailyBreakdown.map((d: any) => [
        new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }),
        hmSum(d.loginTime),
        hmSum(d.logoutTime),
        d.loggedHours,
        d.activityCount,
      ]),
      {
        alignCenterCols: [1, 2],
        boldCols: [0],
      },
    );
  }

  // ─── 2. Daily Activity Log Sheet ──────────────────────────────────────────
  if (da0?.dailyBreakdown?.length > 0) {
    const actSheet = workbook.addWorksheet('Daily Activity Log', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
      views: [{ showGridLines: true, state: 'frozen', ySplit: 4 }],
    });
    actSheet.columns = [
      { width: 16 }, { width: 14 }, { width: 18 }, { width: 18 },
      { width: 28 }, { width: 22 }, { width: 45 },
    ];
    bannerTitle(actSheet, 'Attendance & Daily Activity Log', periodLabel, 7);

    addKpiBlock(actSheet, 'Attendance Summary', [
      { label: 'Days Present', value: da0.daysPresent },
      { label: 'Total Logged Hours', value: `${da0.totalLoggedHours} hrs` },
      { label: 'Total Activities Logged', value: metrics.activities.total },
    ], 7);

    sectionHeader(actSheet, 'Detailed Activity Timeline', 7);

    const headers = ['Date', 'Day', 'Time (In → Out)', 'Activity Type', 'Customer Name', 'Contact Person', 'Description / Work Summary'];
    const headerRow = actSheet.addRow(headers);
    headerRow.height = 22;
    headerRow.eachCell((cell, colNum) => {
      cell.font = { bold: true, size: 10, color: WHITE_TEXT, name: 'Calibri' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: TABLE_HEAD_BG };
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: 'middle', horizontal: colNum === 3 ? 'center' : 'left', indent: colNum === 3 ? 0 : 1 };
    });

    let rowIndex = 0;
    da0.dailyBreakdown.forEach((day: any) => {
      const dateStr = new Date(day.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const dayOfWeek = new Date(day.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' });
      const entries = day.entries || [];

      if (entries.length === 0) {
        const row = actSheet.addRow([dateStr, dayOfWeek, '—', 'No Activity', '—', '—', 'No activities recorded for this date']);
        row.height = 20;
        const bg = rowIndex % 2 === 0 ? WHITE_BG : ZEBRA_BG;
        row.eachCell((cell, colNum) => {
          cell.border = THIN_BORDER;
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: bg };
          cell.font = { size: 9, color: MUTED_TEXT, italic: true, name: 'Calibri' };
          cell.alignment = { vertical: 'middle', horizontal: colNum === 3 ? 'center' : 'left', indent: colNum === 3 ? 0 : 1 };
        });
        rowIndex++;
      } else {
        entries.forEach((raw: any) => {
          let actType = 'Activity', time = '—', customer = '—', contact = '—', description = '—';
          if (typeof raw === 'string') {
            description = raw;
          } else {
            actType = ACTIVITY_MODE_LABELS[raw.mode] || raw.mode || 'Activity';
            time = raw.timeIn ? `${raw.timeIn}${raw.timeOut ? ` → ${raw.timeOut}` : ''}` : '—';
            customer = raw.custName || '—';
            contact = raw.contactPerson || '—';
            description = raw.description || '—';
          }
          const row = actSheet.addRow([dateStr, dayOfWeek, time, actType, customer, contact, description]);
          row.height = 20;
          const bg = rowIndex % 2 === 0 ? WHITE_BG : ZEBRA_BG;
          row.eachCell((cell, colNum) => {
            cell.border = THIN_BORDER;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: bg };
            cell.font = { size: 10, color: DARK_TEXT, bold: colNum === 4, name: 'Calibri' };
            cell.alignment = { vertical: 'middle', horizontal: colNum === 3 ? 'center' : 'left', indent: colNum === 3 ? 0 : 1, wrapText: colNum === 7 };
          });
        });
        rowIndex++;
      }
    });

    actSheet.addRow([]);
  }

  // ─── 3. Revenue & Deals Sheet ──────────────────────────────────────────────
  const revSheet = workbook.addWorksheet('Revenue & Deals', {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
    views: [{ showGridLines: true, state: 'frozen', ySplit: 4 }],
  });
  revSheet.columns = [{ width: 30 }, { width: 20 }, { width: 18 }, { width: 18 }];
  bannerTitle(revSheet, 'Revenue & Deals Breakdown', periodLabel, 4);

  addKpiBlock(revSheet, 'Revenue Summary', [
    { label: 'Total Revenue', value: metrics.revenue.total, fmt: 'currency' },
    { label: 'Pipeline Value', value: metrics.revenue.pipeline, fmt: 'currency' },
    { label: 'Average Deal Value', value: metrics.revenue.average, fmt: 'currency' },
  ], 4);

  if (metrics.revenue.byMonth && metrics.revenue.byMonth.length > 0) {
    addTable(revSheet, 'Revenue by Month', ['Month', 'Revenue'],
      metrics.revenue.byMonth.map((r: any) => [r.month, r.revenue]),
      { currencyCols: [1] },
    );
  }

  if (topDeals && topDeals.length > 0) {
    addTable(revSheet, 'Top Deals Won', ['Deal Name', 'Value', 'Closed Date', 'Status'],
      topDeals.map((d) => [d.dealName, d.value, new Date(d.closedDate).toLocaleDateString('en-IN'), d.status]),
      { currencyCols: [1], statusCol: { index: 3, resolver: (v: string) => STATUS_STYLE[v] || null } },
    );
  }

  // ─── 4. Leads & Conversion Sheet ──────────────────────────────────────────
  const leadsSheet = workbook.addWorksheet('Leads & Conversion', {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
    views: [{ showGridLines: true }],
  });
  leadsSheet.columns = [{ width: 24 }, { width: 16 }, { width: 16 }, { width: 16 }];
  bannerTitle(leadsSheet, 'Leads & Conversion', periodLabel, 4);

  const leadsTotal = metrics.leads.total || 1;
  addTable(leadsSheet, 'Leads by Status', ['Status', 'Count', 'Share (%)'],
    Object.entries(metrics.leads.byStatus || {}).map(([status, count]) => [
      status, count as number, Math.round((((count as number) / leadsTotal) * 100) * 10) / 10,
    ]),
    { percentCols: [2] },
  );

  if (metrics.conversion.bySource && Object.keys(metrics.conversion.bySource).length > 0) {
    addTable(leadsSheet, 'Conversion by Source', ['Source', 'Total Leads', 'Won', 'Win Rate (%)'],
      Object.entries(metrics.conversion.bySource).map(([src, d]: [string, any]) => [
        src, d.total, d.won, d.rate,
      ]),
      { percentCols: [3] },
    );
  }

  const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  return buffer;
}
