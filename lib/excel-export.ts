import ExcelJS from 'exceljs';

// ─── Palette ────────────────────────────────────────────────────────────────

const BANNER_BG = { argb: 'FF1E3A6E' };   // deep navy — report title
const SECTION_BG = { argb: 'FF2E5090' };  // section header blue
const TABLE_HEAD_BG = { argb: 'FF4472C4' }; // table header blue (lighter than section)
const ZEBRA_BG = { argb: 'FFEDF1FA' };    // faint blue zebra stripe
const WHITE_BG = { argb: 'FFFFFFFF' };
const WHITE_TEXT = { argb: 'FFFFFFFF' };
const MUTED_TEXT = { argb: 'FF6B7280' };
const DARK_TEXT = { argb: 'FF1F2937' };
const GREEN_TEXT = { argb: 'FF15803D' };
const GREEN_BG = { argb: 'FFDCFCE7' };
const RED_TEXT = { argb: 'FFDC2626' };
const RED_BG = { argb: 'FFFEE2E2' };
const AMBER_BG = { argb: 'FFFEF3C7' };
const AMBER_TEXT = { argb: 'FF92400E' };
const BLUE_BG = { argb: 'FFDBEAFE' };
const BLUE_TEXT = { argb: 'FF1D4ED8' };
const BORDER = { style: 'thin' as const, color: { argb: 'FFD1D5DB' } };
const THIN_BORDER = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };

const CURRENCY_FMT = '"₹" #,##0';
const PERCENT_FMT = '0.0"%"';

type Row = (string | number)[];

interface TableOptions {
  currencyCols?: number[]; // 0-based column indices to format as currency
  percentCols?: number[];  // 0-based column indices to format as percent
  boldCols?: number[];     // 0-based column indices to bold
  colorCol?: { index: number; resolver: (val: any) => { argb: string } | null }; // font color based on value
  statusCol?: { index: number; resolver: (val: any) => { bg: { argb: string }; text: { argb: string } } | null };
  rowBg?: (rowIndex: number) => { argb: string }; // override the default zebra background per row
}

function bannerTitle(sheet: ExcelJS.Worksheet, title: string, subtitle: string, span: number) {
  const titleRow = sheet.addRow([title]);
  sheet.mergeCells(titleRow.number, 1, titleRow.number, span);
  titleRow.height = 26;
  titleRow.getCell(1).font = { bold: true, size: 15, color: WHITE_TEXT };
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: BANNER_BG };
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  const subRow = sheet.addRow([subtitle]);
  sheet.mergeCells(subRow.number, 1, subRow.number, span);
  subRow.height = 18;
  subRow.getCell(1).font = { size: 10, color: WHITE_TEXT, italic: true };
  subRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: SECTION_BG };
  subRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  sheet.addRow([]);
}

function sectionHeader(sheet: ExcelJS.Worksheet, label: string, span: number) {
  const row = sheet.addRow([label]);
  sheet.mergeCells(row.number, 1, row.number, span);
  row.height = 20;
  row.getCell(1).font = { bold: true, size: 11, color: WHITE_TEXT };
  row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: SECTION_BG };
  row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  return row;
}

// Renders a section header + a bordered table (header row + data rows, zebra striped)
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
  headerRow.eachCell((cell, colNum) => {
    cell.font = { bold: true, size: 10, color: WHITE_TEXT };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: TABLE_HEAD_BG };
    cell.border = THIN_BORDER;
    cell.alignment = { vertical: 'middle', horizontal: colNum === 1 ? 'left' : 'right' };
  });

  rows.forEach((r, i) => {
    const dataRow = sheet.addRow(r);
    const bg = opts.rowBg ? opts.rowBg(i) : i % 2 === 0 ? WHITE_BG : ZEBRA_BG;
    dataRow.eachCell((cell, colNum) => {
      const colIdx = colNum - 1;
      cell.border = THIN_BORDER;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: bg };
      cell.font = { size: 10, color: DARK_TEXT, bold: opts.boldCols?.includes(colIdx) };
      cell.alignment = { vertical: 'middle', horizontal: colIdx === 0 ? 'left' : 'right' };

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
          cell.font = { size: 10, bold: true, color: style.text };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        }
      }
    });
  });

  sheet.addRow([]);
  return rows.length;
}

// A compact two-column "label / value" KPI block (not a full table — used for summary cards)
function addKpiBlock(sheet: ExcelJS.Worksheet, title: string, kpis: { label: string; value: string | number; fmt?: 'currency' | 'percent' }[], span: number) {
  sectionHeader(sheet, title, span);
  kpis.forEach((kpi, i) => {
    const row = sheet.addRow([kpi.label, kpi.value]);
    const bg = i % 2 === 0 ? WHITE_BG : ZEBRA_BG;
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: bg };
    row.getCell(1).font = { size: 10, color: DARK_TEXT };
    row.getCell(1).border = THIN_BORDER;
    row.getCell(1).alignment = { vertical: 'middle', indent: 1 };

    row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: bg };
    row.getCell(2).font = { size: 12, bold: true, color: SECTION_BG };
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

// Alternating background per DAY (not per row) so day boundaries are visually
// obvious at a glance — a flagged (>30min unaccounted) day always reads red
// regardless of which band it would otherwise fall on.
const DAY_BAND_A = { header: { argb: 'FFD6E0F5' }, entry: { argb: 'FFF2F5FC' } }; // blue band
const DAY_BAND_B = { header: { argb: 'FFE2E2E8' }, entry: { argb: 'FFF6F6F8' } }; // grey band
function dayBandColors(dayIndex: number, flagged: boolean) {
  if (flagged) return { header: RED_BG, entry: { argb: 'FFFDEDED' }, text: RED_TEXT };
  const band = dayIndex % 2 === 0 ? DAY_BAND_A : DAY_BAND_B;
  return { header: band.header, entry: band.entry, text: DARK_TEXT };
}

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
  workbook.created = new Date(0); // deterministic; actual timestamp not load-bearing for a report doc

  const periodLabel = `${new Date(period.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} – ${new Date(period.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}  (${period.days} days)`;

  // ─── 1. Summary ─────────────────────────────────────────────────────────
  const da0 = metrics.dailyActivity;
  const productivityRate = da0 && da0.totalLoggedHours > 0 ? Math.round((da0.totalActivityHours / da0.totalLoggedHours) * 100) : 0;

  const summary = workbook.addWorksheet('Summary', { pageSetup: { paperSize: 9, orientation: 'landscape' }, views: [{ showGridLines: false, state: 'frozen', ySplit: 4 }] });
  summary.columns = [{ width: 26 }, { width: 18 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 30 }, { width: 12 }];
  bannerTitle(summary, `Personal Performance Report — ${user.name}`, `${user.role.replace(/_/g, ' ')} · ${user.email} · ${periodLabel}`, 7);

  addKpiBlock(summary, 'Key Metrics', [
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
    { label: 'Avg Days to Close', value: metrics.salesCycle.avgDuration },
    { label: 'Median Days to Close', value: metrics.salesCycle.median },
    { label: 'Performance Score', value: metrics.performance.score },
    ...(da0 ? [
      { label: 'Days Present', value: da0.daysPresent },
      { label: 'Productivity Rate', value: productivityRate, fmt: 'percent' as const },
    ] : []),
  ], 7);

  // Day-by-day attendance, right here on the Summary sheet — every day
  // color-banded so day boundaries are visible at a glance without needing
  // to switch to the Daily Activity tab. Full per-entry timeline lives there.
  if (da0?.dailyBreakdown?.length > 0) {
    const hmSum = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—');
    addTable(summary, 'Daily Attendance Overview', ['Date', 'Login', 'Logout', 'Logged Hrs', 'Activity Hrs', 'Gap Hrs', 'Entries'],
      da0.dailyBreakdown.map((d: any) => [
        new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' }),
        hmSum(d.loginTime), hmSum(d.logoutTime), d.loggedHours, d.activityHours, d.unproductiveHours, d.activityCount,
      ]),
      {
        rowBg: (i: number) => dayBandColors(i, da0.dailyBreakdown[i].unproductiveHours > 0.5).header,
        colorCol: { index: 5, resolver: (v: number) => (v > 0.5 ? RED_TEXT : null) },
      },
    );
  }

  addTable(summary, 'Performance Score Breakdown', ['Component', 'Score'], [
    ['Win Rate', metrics.performance.breakdown.winRate],
    ['Revenue', metrics.performance.breakdown.revenue],
    ['Activity', metrics.performance.breakdown.activity],
    ['Leads', metrics.performance.breakdown.leads],
  ], { boldCols: [1] });

  if (metrics.comparison) {
    const rows: Row[] = (['revenue', 'leads', 'converted', 'winRate', 'activities'] as const).map((k) => {
      const m = metrics.comparison.metrics[k];
      const label = { revenue: 'Revenue', leads: 'Leads', converted: 'Converted', winRate: 'Win Rate', activities: 'Activities' }[k];
      return [label, m.current, m.previous, m.deltaPct];
    });
    addTable(summary, `vs. Previous Period (${new Date(metrics.comparison.previousPeriod.startDate).toLocaleDateString('en-IN')} – ${new Date(metrics.comparison.previousPeriod.endDate).toLocaleDateString('en-IN')})`,
      ['Metric', 'Current', 'Previous', 'Change'],
      rows,
      {
        percentCols: [3],
        colorCol: { index: 3, resolver: (v: number) => (v > 0 ? GREEN_TEXT : v < 0 ? RED_TEXT : null) },
      },
    );
  }

  // ─── 2. Leads & Conversion ──────────────────────────────────────────────
  const leadsSheet = workbook.addWorksheet('Leads & Conversion', { pageSetup: { paperSize: 9, orientation: 'landscape' }, views: [{ showGridLines: false }] });
  leadsSheet.columns = [{ width: 22 }, { width: 16 }, { width: 16 }, { width: 16 }];
  bannerTitle(leadsSheet, 'Leads & Conversion', periodLabel, 4);

  const leadsTotal = metrics.leads.total || 1;
  addTable(leadsSheet, 'Leads by Status', ['Status', 'Count', 'Share'],
    Object.entries(metrics.leads.byStatus || {}).map(([status, count]) => [
      status, count as number, ((count as number) / leadsTotal) * 100,
    ]),
    { percentCols: [2] },
  );

  addTable(leadsSheet, 'Conversion by Source', ['Source', 'Total Leads', 'Won', 'Win Rate'],
    Object.entries(metrics.conversion.bySource || {}).map(([src, d]: [string, any]) => [
      src, d.total, d.won, d.rate,
    ]),
    { percentCols: [3] },
  );

  if (metrics.revenue.bySource && Object.keys(metrics.revenue.bySource).length > 0) {
    addTable(leadsSheet, 'Revenue by Source', ['Source', 'Revenue'],
      Object.entries(metrics.revenue.bySource).map(([src, rev]) => [src, rev as number]),
      { currencyCols: [1] },
    );
  }

  // ─── 3. Revenue & Deals ─────────────────────────────────────────────────
  const revSheet = workbook.addWorksheet('Revenue & Deals', { pageSetup: { paperSize: 9, orientation: 'landscape' }, views: [{ showGridLines: false }] });
  revSheet.columns = [{ width: 28 }, { width: 18 }, { width: 16 }, { width: 16 }];
  bannerTitle(revSheet, 'Revenue & Deals', periodLabel, 4);

  addKpiBlock(revSheet, 'Revenue Summary', [
    { label: 'Total Revenue', value: metrics.revenue.total, fmt: 'currency' },
    { label: 'Pipeline Value', value: metrics.revenue.pipeline, fmt: 'currency' },
    { label: 'Average Deal Value', value: metrics.revenue.average, fmt: 'currency' },
  ], 4);

  addTable(revSheet, 'Revenue by Month', ['Month', 'Revenue'],
    (metrics.revenue.byMonth || []).map((r: any) => [r.month, r.revenue]),
    { currencyCols: [1] },
  );

  addTable(revSheet, 'Top Deals', ['Deal Name', 'Value', 'Closed Date', 'Status'],
    (topDeals || []).map((d) => [d.dealName, d.value, new Date(d.closedDate).toLocaleDateString('en-IN'), d.status]),
    { currencyCols: [1], statusCol: { index: 3, resolver: (v: string) => STATUS_STYLE[v] || null } },
  );

  // ─── 4. Pipeline & Loss Analysis ────────────────────────────────────────
  if (metrics.pipeline || metrics.lossAnalysis) {
    const pipeSheet = workbook.addWorksheet('Pipeline & Loss', { pageSetup: { paperSize: 9, orientation: 'landscape' }, views: [{ showGridLines: false }] });
    pipeSheet.columns = [{ width: 24 }, { width: 16 }, { width: 18 }, { width: 18 }];
    bannerTitle(pipeSheet, 'Pipeline & Loss Analysis', periodLabel, 4);

    if (metrics.pipeline) {
      addTable(pipeSheet, 'Own Pipeline by Stage', ['Stage', 'Deals', 'Total Value', 'Weighted Value'],
        metrics.pipeline.stages.map((s: any) => [s.stage, s.dealCount, s.totalValue, s.weightedValue]),
        { currencyCols: [2, 3] },
      );
      addKpiBlock(pipeSheet, 'Pipeline Forecast', [
        { label: 'Total Active Deals', value: metrics.pipeline.totalDeals },
        { label: 'Total Pipeline Value', value: metrics.pipeline.totalValue, fmt: 'currency' },
        { label: 'Weighted Forecast', value: metrics.pipeline.weightedForecast, fmt: 'currency' },
      ], 4);
    }

    if (metrics.lossAnalysis && metrics.lossAnalysis.totalLost > 0) {
      addKpiBlock(pipeSheet, 'Loss Summary', [
        { label: 'Lost Deals', value: metrics.lossAnalysis.lostCount },
        { label: 'Dropped Deals', value: metrics.lossAnalysis.droppedCount },
        { label: 'Total Lost Value', value: metrics.lossAnalysis.lostValue, fmt: 'currency' },
      ], 4);
      addTable(pipeSheet, 'Loss Reasons', ['Reason', 'Count', 'Value'],
        metrics.lossAnalysis.byReason.map((r: any) => [r.reason, r.count, r.lostValue]),
        { currencyCols: [2] },
      );
    }
  }

  // ─── 5. Follow-ups & Sales Cycle ────────────────────────────────────────
  if (metrics.followUpPunctuality) {
    const fuSheet = workbook.addWorksheet('Follow-ups', { pageSetup: { paperSize: 9, orientation: 'landscape' }, views: [{ showGridLines: false }] });
    fuSheet.columns = [{ width: 26 }, { width: 18 }, { width: 18 }, { width: 18 }];
    bannerTitle(fuSheet, 'Follow-up Punctuality & Sales Cycle', periodLabel, 4);

    addKpiBlock(fuSheet, 'Follow-up Punctuality', [
      { label: 'Completed', value: metrics.followUpPunctuality.completed },
      { label: 'On Time', value: metrics.followUpPunctuality.onTime },
      { label: 'Late', value: metrics.followUpPunctuality.late },
      { label: 'On-Time Rate', value: metrics.followUpPunctuality.onTimeRate, fmt: 'percent' },
      { label: 'Avg Delay (days)', value: metrics.followUpPunctuality.avgDelayDays },
    ], 4);

    addKpiBlock(fuSheet, 'Sales Cycle', [
      { label: 'Average Duration (days)', value: metrics.salesCycle.avgDuration },
      { label: 'Median Duration (days)', value: metrics.salesCycle.median },
    ], 4);
  }

  // ─── 6. Daily Activity ───────────────────────────────────────────────────
  if (da0?.dailyBreakdown?.length > 0) {
    const da = da0;

    const actSheet = workbook.addWorksheet('Daily Activity', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
      views: [{ showGridLines: false }],
      properties: { outlineLevelRow: 1 },
    });
    actSheet.properties.outlineProperties = { summaryBelow: false, summaryRight: false };
    actSheet.columns = [{ width: 16 }, { width: 20 }, { width: 16 }, { width: 20 }, { width: 20 }, { width: 38 }, { width: 12 }];
    bannerTitle(actSheet, 'Attendance & Daily Activity', periodLabel, 7);

    addKpiBlock(actSheet, 'Attendance Summary', [
      { label: 'Days Present', value: da.daysPresent },
      { label: 'Total Logged Hours', value: `${da.totalLoggedHours}h` },
      { label: 'Activity-Covered Hours', value: `${da.totalActivityHours}h` },
      { label: 'Unproductive Hours', value: `${da.totalUnproductiveHours}h` },
      { label: 'Productivity Rate', value: productivityRate, fmt: 'percent' },
      { label: 'Days with >30min Unaccounted', value: da.unproductiveDays },
    ], 7);

    sectionHeader(actSheet, 'Day-by-Day Timeline  —  each day is color-banded; click the − / + markers on the left to collapse/expand a day', 7);
    const hm = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—');

    da.dailyBreakdown.forEach((day: any, dayIdx: number) => {
      const flagged = day.unproductiveHours > 0.5;
      const band = dayBandColors(dayIdx, flagged);
      const dateStr = new Date(day.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

      // Day header (summary) row — outline level 0, stays visible when collapsed.
      const dayRow = actSheet.addRow([
        dateStr,
        `${hm(day.loginTime)} → ${hm(day.logoutTime)}`,
        `${day.loggedHours}h logged`,
        `${day.activityHours}h covered`,
        `${day.unproductiveHours}h gap`,
        '',
        `${day.activityCount} ${day.activityCount === 1 ? 'entry' : 'entries'}`,
      ]);
      dayRow.eachCell((cell, colNum) => {
        cell.border = THIN_BORDER;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: band.header };
        cell.font = { bold: true, size: 10, color: colNum === 5 && flagged ? RED_TEXT : band.text };
        cell.alignment = { vertical: 'middle', horizontal: colNum === 1 ? 'left' : colNum === 7 ? 'right' : 'center' };
      });

      const entries = day.entries || [];
      if (entries.length === 0) {
        const emptyRow = actSheet.addRow(['', '—', 'No activities logged for this day.', '', '', '', '']);
        emptyRow.outlineLevel = 1;
        emptyRow.eachCell((cell) => {
          cell.border = THIN_BORDER;
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: band.entry };
          cell.font = { italic: true, size: 9, color: MUTED_TEXT };
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        });
        return;
      }

      entries.forEach((raw: any) => {
        let actType = 'Activity', time = '', customer = '', contact = '', description = '';
        if (typeof raw === 'string') {
          description = raw;
        } else {
          actType = ACTIVITY_MODE_LABELS[raw.mode] || raw.mode || 'Activity';
          time = raw.timeIn ? `${raw.timeIn}${raw.timeOut ? ` → ${raw.timeOut}` : ''}` : '';
          customer = raw.custName || '';
          contact = raw.contactPerson || '';
          description = raw.description || '';
        }
        const entryRow = actSheet.addRow(['', time, actType, customer, contact, description, '']);
        entryRow.outlineLevel = 1;
        entryRow.eachCell((cell, colNum) => {
          cell.border = THIN_BORDER;
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: band.entry };
          cell.font = { size: 9, color: DARK_TEXT, bold: colNum === 3 };
          cell.alignment = { vertical: 'middle', horizontal: colNum === 2 ? 'center' : 'left', wrapText: colNum === 6 };
        });
        actSheet.mergeCells(entryRow.number, 6, entryRow.number, 7);
      });
    });

    const totalRow = actSheet.addRow(['TOTAL', '', `${da.totalLoggedHours}h logged`, `${da.totalActivityHours}h covered`, `${da.totalUnproductiveHours}h gap`, '', '']);
    totalRow.eachCell((cell, colNum) => {
      cell.font = { bold: true, size: 10, color: WHITE_TEXT };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: SECTION_BG };
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: 'middle', horizontal: colNum === 1 ? 'left' : 'center' };
    });

    actSheet.views = [{ state: 'frozen', ySplit: 4, showGridLines: false }];
  }

  const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  return buffer;
}
