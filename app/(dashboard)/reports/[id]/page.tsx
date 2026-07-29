'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useRequireRole } from '@/lib/hooks/useRequireRole';
import { ReportIcon } from '@/components/icons';
import { generatePersonalReportExcel } from '@/lib/excel-export';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Period { startDate: string; endDate: string; days: number }

interface PersonalReport {
  reportType: 'PERSONAL';
  id: string;
  user: { id: string; name: string; email: string; role: string };
  period: Period;
  metrics: {
    leads: { total: number; closed: number; converted: number; byStatus: Record<string, number>; bySource: Record<string, number> };
    revenue: { total: number; pipeline: number; average: number; byMonth: { month: string; revenue: number }[]; bySource: Record<string, number> };
    conversion: { winRate: number; conversionRate: number; bySource: Record<string, { total: number; won: number; rate: number }> };
    activities: { total: number; followupsCompleted: number; tasksCompleted: number };
    salesCycle: { avgDuration: number; median: number };
    performance: { score: number; breakdown: { winRate: number; revenue: number; activity: number; leads: number } };
    dailyActivity?: {
      totalLoggedHours: number; totalActivityHours: number; daysPresent: number;
      dailyBreakdown: { date: string; loginTime?: string | null; logoutTime?: string | null; loggedHours: number; activityHours: number; activityCount: number; entries?: any[] }[];
    };
    comparison?: {
      previousPeriod: { startDate: string; endDate: string };
      metrics: Record<'revenue' | 'leads' | 'converted' | 'winRate' | 'activities', { current: number; previous: number; deltaPct: number }>;
    };
    followUpPunctuality?: { completed: number; onTime: number; late: number; onTimeRate: number; avgDelayDays: number };
    lossAnalysis?: {
      totalLost: number; lostCount: number; droppedCount: number; lostValue: number;
      byReason: { reason: string; count: number; lostValue: number }[];
    };
    pipeline?: {
      stages: { stage: string; dealCount: number; totalValue: number; weightedValue: number }[];
      totalDeals: number; totalValue: number; weightedForecast: number;
    };
  };
  topDeals: { id: string; dealName: string; value: number; closedDate: string; status: string }[];
}

interface TeamReport {
  reportType: 'TEAM';
  id: string;
  manager: { id: string; name: string; role: string };
  period: Period;
  teamSize: number;
  metrics: {
    members: { rank: number; userId: string; name: string; role: string; leads: number; converted: number; revenue: number; avgDealValue: number; winRate: number; activities: number }[];
    totals: { totalLeads: number; totalConverted: number; totalRevenue: number; totalActivities: number };
    average: { revenue: number; leads: number; winRate: number };
  };
}

interface PipelineReport {
  reportType: 'PIPELINE';
  id: string;
  period: Period;
  metrics: {
    stages: { stage: string; dealCount: number; totalValue: number; avgValue: number }[];
    forecast: { expectedRevenue: number; totalDeals: number };
  };
}

type ReportData = PersonalReport | TeamReport | PipelineReport;

// ─── Constants ───────────────────────────────────────────────────────────────

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
const STAGE_COLORS: Record<string, string> = {
  SUSPECT: '#6b7280', PROSPECT: '#3b82f6', APPROACH: '#8b5cf6',
  NEGOTIATION: '#f59e0b', CLOSURE: '#10b981', ONGOING: '#06b6d4',
};

// Same activity-mode labels the attendance timeline uses, so the report reads
// identically to the per-day modal.
const ACTIVITY_MODE_LABELS: Record<string, string> = {
  MEETING: 'Meeting', CALL: 'Call', SITE_VISIT: 'Site Visit', DEMO: 'Demo',
  PROPOSAL: 'Proposal', NEGOTIATION: 'Negotiation', FOLLOW_UP: 'Follow-up',
  EMAIL: 'Email', WORK: 'Internal Work', TRAINING: 'Training', OTHER: 'Other',
};

// A daily-activity entry can be the rich object shape or a legacy plain string.
function normalizeEntry(raw: any) {
  if (typeof raw === 'string') {
    return { label: 'Activity', time: '', customer: '', contact: '', description: raw };
  }
  const t = (raw.timeIn || raw.timeOut)
    ? `${raw.timeIn || '—'}${raw.timeOut ? ` → ${raw.timeOut}` : ''}`
    : '';
  return {
    label: ACTIVITY_MODE_LABELS[raw.mode] || raw.mode || 'Activity',
    time: t,
    customer: raw.custName || '',
    contact: raw.contactPerson || '',
    description: raw.description || '',
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const inr = (val: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

const inrShort = (val: number) => {
  if (val >= 10_000_000) return `₹${(val / 10_000_000).toFixed(1)}Cr`;
  if (val >= 100_000) return `₹${(val / 100_000).toFixed(1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(0)}K`;
  return `₹${val}`;
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-2 ${accent ?? 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-800 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-48 text-sm text-gray-400">
      No data for this period
    </div>
  );
}

// Up/down delta badge. `goodWhenUp` flips colour for metrics where a drop is good.
function DeltaBadge({ pct }: { pct: number }) {
  if (pct === 0) return <span className="text-xs font-medium text-gray-400">—</span>;
  const up = pct > 0;
  return (
    <span className={`text-xs font-bold ${up ? 'text-green-600' : 'text-red-600'}`}>
      {up ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  );
}

// ─── Personal Report Sections ────────────────────────────────────────────────

// Attendance + a day-by-day activity timeline. Each day expands to show the
// same entries as the attendance modal, for the whole selected report range.
function DailyActivitySection({ da }: { da: NonNullable<PersonalReport['metrics']['dailyActivity']> }) {
  const [openDates, setOpenDates] = useState<Set<string>>(new Set());
  const toggle = (date: string) =>
    setOpenDates((prev) => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });

  const hm = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—');
  const totalActivitiesCount = da.dailyBreakdown.reduce((sum, d) => sum + d.activityCount, 0);

  return (
    <div className="mt-5">
      <SectionCard title="Attendance & Daily Activity">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div className="bg-blue-50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-700">{da.daysPresent}</p>
            <p className="text-xs text-blue-600 mt-1 font-medium">Days Present</p>
          </div>
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-700">{da.totalLoggedHours}h</p>
            <p className="text-xs text-green-600 mt-1 font-medium">Total Logged Hours</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-purple-700">{totalActivitiesCount}</p>
            <p className="text-xs text-purple-600 mt-1 font-medium">Activities Logged</p>
          </div>
        </div>

        {/* Day-by-day timeline */}
        {da.dailyBreakdown.length > 0 && (
          <div className="space-y-2">
            {da.dailyBreakdown.map((d) => {
              const open = openDates.has(d.date);
              const entries = d.entries || [];
              return (
                <div key={d.date} className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggle(d.date)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 bg-white"
                  >
                    <span className="text-gray-400 text-xs w-4">{open ? '▾' : '▸'}</span>
                    <span className="text-sm font-medium text-gray-800 w-40">
                      {new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="text-xs text-gray-500">{hm(d.loginTime)} → {hm(d.logoutTime)}</span>
                    <span className="ml-auto flex items-center gap-3 text-xs">
                      <span className="text-gray-700 font-medium">{d.loggedHours}h logged</span>
                      <span className="bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5 font-medium">{d.activityCount} {d.activityCount === 1 ? 'entry' : 'entries'}</span>
                    </span>
                  </button>

                  {open && (
                    <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
                      {entries.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">No activities logged for this day.</p>
                      ) : (
                        <ol className="space-y-2">
                          {entries.map((raw, i) => {
                            const e = normalizeEntry(raw);
                            return (
                              <li key={i} className="flex items-start gap-3 text-sm">
                                <span className="text-[11px] font-mono text-gray-400 w-28 flex-shrink-0 pt-0.5">{e.time || '—'}</span>
                                <div className="min-w-0">
                                  <p className="font-medium text-gray-800">
                                    {e.label}
                                    {e.customer && <span className="text-gray-400 font-normal"> · {e.customer}</span>}
                                    {e.contact && <span className="text-gray-400 font-normal"> · {e.contact}</span>}
                                  </p>
                                  {e.description && <p className="text-xs text-gray-500 mt-0.5">{e.description}</p>}
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function PersonalView({ report }: { report: PersonalReport }) {
  const { metrics, topDeals } = report;

  const byMonthData = metrics.revenue.byMonth || [];
  const byStatusData = Object.entries(metrics.leads.byStatus || {})
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
  const bySourcePie = Object.entries(metrics.revenue.bySource || {})
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));
  const conversionTable = Object.entries(metrics.conversion.bySource || {})
    .sort((a, b) => b[1].total - a[1].total);

  const hasRevenueData = metrics.revenue.total > 0 || byMonthData.length > 0 || bySourcePie.length > 0;
  const hasPipelineData = metrics.pipeline && metrics.pipeline.totalDeals > 0;
  const hasFollowupData = metrics.followUpPunctuality && metrics.followUpPunctuality.completed > 0;

  return (
    <div className="space-y-6">
      {/* 1. Essential Executive KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total Leads" value={metrics.leads.total} sub={`${metrics.leads.converted} converted`} />
        <MetricCard label="Win Rate" value={`${metrics.conversion.winRate}%`} sub={`Conversion: ${metrics.conversion.conversionRate}%`} accent="text-blue-600" />
        <MetricCard label="Total Revenue" value={inrShort(metrics.revenue.total)} sub={`Pipeline: ${inrShort(metrics.revenue.pipeline)}`} accent="text-green-600" />
        <MetricCard label="Avg Deal Value" value={inrShort(metrics.revenue.average)} sub={`${topDeals.length} deals won`} />
      </div>

      {/* 2. Attendance & Daily Activity Timeline (Essential) */}
      {metrics.dailyActivity && <DailyActivitySection da={metrics.dailyActivity} />}

      {/* 3. Lead & Conversion Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {byStatusData.length > 0 && (
          <SectionCard title="Leads by Status">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byStatusData} margin={{ top: 4, right: 8, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="status" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        )}

        {conversionTable.length > 0 && (
          <SectionCard title="Conversion by Source">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Source</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Leads</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Won</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Win Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {conversionTable.map(([source, data]) => (
                    <tr key={source} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 px-3 text-gray-700 font-medium">{source}</td>
                      <td className="py-2.5 px-3 text-right text-gray-600">{data.total}</td>
                      <td className="py-2.5 px-3 text-right text-green-700 font-medium">{data.won}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          data.rate >= 70 ? 'bg-green-100 text-green-700' :
                          data.rate >= 40 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {data.rate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}
      </div>

      {/* 4. Top Deals Won (Only shown if deals exist) */}
      {topDeals.length > 0 && (
        <SectionCard title="Top Deals Won">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">#</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Deal</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Value</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Closed Date</th>
                </tr>
              </thead>
              <tbody>
                {topDeals.map((deal, i) => (
                  <tr key={deal.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 px-3 text-gray-400 font-mono text-xs">{i + 1}</td>
                    <td className="py-2.5 px-3 text-gray-800 font-medium">{deal.dealName}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-green-700">{inr(deal.value)}</td>
                    <td className="py-2.5 px-3 text-gray-500 text-xs">{deal.closedDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* 5. Revenue Charts (Only shown if revenue data exists) */}
      {hasRevenueData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {byMonthData.length > 0 && (
            <SectionCard title="Revenue Over Time">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={byMonthData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => inrShort(v)} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => inr(v)} />
                  <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </SectionCard>
          )}

          {bySourcePie.length > 0 && (
            <SectionCard title="Revenue by Source">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={bySourcePie}
                    cx="50%" cy="50%"
                    outerRadius={85}
                    dataKey="value"
                    label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {bySourcePie.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => inr(v)} />
                </PieChart>
              </ResponsiveContainer>
            </SectionCard>
          )}
        </div>
      )}

      {/* 6. Active Pipeline (Only shown if active deals exist) */}
      {hasPipelineData && (
        <SectionCard title="Active Pipeline Stage Breakdown">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-blue-700">{metrics.pipeline!.totalDeals}</p>
              <p className="text-xs text-blue-600 mt-1">Active Deals</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-gray-800">{inrShort(metrics.pipeline!.totalValue)}</p>
              <p className="text-xs text-gray-500 mt-1">Total Value</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-green-700">{inrShort(metrics.pipeline!.weightedForecast)}</p>
              <p className="text-xs text-green-600 mt-1">Weighted Forecast</p>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Stage</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Deals</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Value</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Weighted</th>
              </tr>
            </thead>
            <tbody>
              {metrics.pipeline!.stages.map(s => (
                <tr key={s.stage} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2.5 px-3">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: `${STAGE_COLORS[s.stage] ?? '#6b7280'}20`, color: STAGE_COLORS[s.stage] ?? '#6b7280' }}
                    >
                      {s.stage}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right text-gray-700">{s.dealCount}</td>
                  <td className="py-2.5 px-3 text-right text-gray-800 font-medium">{inr(s.totalValue)}</td>
                  <td className="py-2.5 px-3 text-right text-green-700">{inr(s.weightedValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      )}

      {/* 7. Follow-up Punctuality (Only shown if follow-ups completed exist) */}
      {hasFollowupData && (
        <SectionCard title="Follow-up Punctuality">
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke={metrics.followUpPunctuality!.onTimeRate >= 70 ? '#10b981' : metrics.followUpPunctuality!.onTimeRate >= 40 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="3"
                  strokeDasharray={`${metrics.followUpPunctuality!.onTimeRate} ${100 - metrics.followUpPunctuality!.onTimeRate}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-base font-bold text-gray-900">{metrics.followUpPunctuality!.onTimeRate}%</span>
              </div>
            </div>
            <div className="flex-1 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Completed</span><span className="font-semibold text-gray-800">{metrics.followUpPunctuality!.completed}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">On time</span><span className="font-semibold text-green-700">{metrics.followUpPunctuality!.onTime}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Late</span><span className="font-semibold text-red-600">{metrics.followUpPunctuality!.late}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Avg delay</span><span className="font-semibold text-gray-800">{metrics.followUpPunctuality!.avgDelayDays} days</span></div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* 8. Loss Analysis (Only shown if lost deals exist) */}
      {metrics.lossAnalysis && metrics.lossAnalysis.totalLost > 0 && (
        <SectionCard title="Loss Analysis">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-red-600">{metrics.lossAnalysis.lostCount}</p>
              <p className="text-xs text-red-500 mt-1">Lost</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-orange-600">{metrics.lossAnalysis.droppedCount}</p>
              <p className="text-xs text-orange-500 mt-1">Dropped</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-gray-800">{inrShort(metrics.lossAnalysis.lostValue)}</p>
              <p className="text-xs text-gray-500 mt-1">Lost Value</p>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Reason</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Count</th>
                <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Value</th>
              </tr>
            </thead>
            <tbody>
              {metrics.lossAnalysis.byReason.map(r => (
                <tr key={r.reason} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2.5 px-3 text-gray-700">{r.reason}</td>
                  <td className="py-2.5 px-3 text-right text-gray-600">{r.count}</td>
                  <td className="py-2.5 px-3 text-right text-gray-800">{inr(r.lostValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      )}
    </div>
  );
}

// ─── Team Report View ─────────────────────────────────────────────────────────

function TeamView({ report }: { report: TeamReport }) {
  const { metrics } = report;

  const revenueChartData = metrics.members.slice(0, 10).map(m => ({
    name: m.name.split(' ')[0],
    revenue: m.revenue,
  }));

  return (
    <>
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Team Size" value={report.teamSize} sub="Active members" />
        <MetricCard label="Total Revenue" value={inrShort(metrics.totals.totalRevenue)} sub={`Avg: ${inrShort(metrics.average.revenue)}`} accent="text-green-600" />
        <MetricCard label="Total Leads" value={metrics.totals.totalLeads} sub={`${metrics.totals.totalConverted} converted`} />
        <MetricCard label="Avg Win Rate" value={`${metrics.average.winRate}%`} sub="Across all members" accent="text-blue-600" />
      </div>

      {/* Revenue bar chart */}
      <div className="mb-5">
        <SectionCard title="Revenue by Team Member">
          {revenueChartData.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={revenueChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => inrShort(v)} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => inr(v)} />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      {/* Leaderboard table */}
      <SectionCard title="Team Leaderboard">
        {metrics.members.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">No team members found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 w-10">Rank</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Name</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Revenue</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Leads</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Won</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Win Rate</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Logged Hours</th>
                </tr>
              </thead>
              <tbody>
                {metrics.members.map((m: any) => {
                  const da = m.dailyActivity;
                  return (
                    <tr key={m.userId} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          m.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                          m.rank === 2 ? 'bg-gray-200 text-gray-700' :
                          m.rank === 3 ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {m.rank}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-semibold text-gray-800">{m.name}</p>
                        <p className="text-xs text-gray-400">{m.role}</p>
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-green-700">{inr(m.revenue)}</td>
                      <td className="py-3 px-3 text-right text-gray-600">{m.leads}</td>
                      <td className="py-3 px-3 text-right text-gray-600">{m.converted}</td>
                      <td className="py-3 px-3 text-right">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          m.winRate >= 70 ? 'bg-green-100 text-green-700' :
                          m.winRate >= 40 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {m.winRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-gray-600">{da ? `${da.totalLoggedHours}h` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold text-gray-700">
                  <td className="py-3 px-3" colSpan={2}>Team Total</td>
                  <td className="py-3 px-3 text-right text-green-700">{inr(metrics.totals.totalRevenue)}</td>
                  <td className="py-3 px-3 text-right">{metrics.totals.totalLeads}</td>
                  <td className="py-3 px-3 text-right">{metrics.totals.totalConverted}</td>
                  <td className="py-3 px-3 text-right">{metrics.average.winRate.toFixed(1)}%</td>
                  <td className="py-3 px-3 text-right">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}

// ─── Pipeline Report View ─────────────────────────────────────────────────────

function PipelineView({ report }: { report: PipelineReport }) {
  const { metrics } = report;

  const barData = metrics.stages.map(s => ({ stage: s.stage, value: s.totalValue, deals: s.dealCount }));

  return (
    <>
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <MetricCard label="Total Pipeline" value={inrShort(metrics.forecast.expectedRevenue)} sub="Across all stages" accent="text-blue-600" />
        <MetricCard label="Total Deals" value={metrics.forecast.totalDeals} sub="Active in pipeline" />
        <MetricCard label="Active Stages" value={metrics.stages.length} sub="With deals" />
      </div>

      {/* Pipeline bar chart */}
      <div className="mb-5">
        <SectionCard title="Pipeline Value by Stage">
          {barData.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => inrShort(v)} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any, name) => name === 'value' ? inr(v) : v} />
                <Legend />
                <Bar dataKey="value" name="Total Value" radius={[4, 4, 0, 0]}>
                  {barData.map((entry) => (
                    <Cell key={entry.stage} fill={STAGE_COLORS[entry.stage] ?? '#6b7280'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      {/* Pipeline table */}
      <SectionCard title="Pipeline Stage Breakdown">
        {metrics.stages.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">No deals in pipeline for this period</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Stage</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Deals</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Total Value</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Avg Value</th>
                  <th className="py-2 px-3 text-xs font-semibold text-gray-500">Share</th>
                </tr>
              </thead>
              <tbody>
                {metrics.stages.map(s => {
                  const share = metrics.forecast.expectedRevenue > 0
                    ? (s.totalValue / metrics.forecast.expectedRevenue) * 100
                    : 0;
                  return (
                    <tr key={s.stage} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-3">
                        <span
                          className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ background: `${STAGE_COLORS[s.stage]}20`, color: STAGE_COLORS[s.stage] }}
                        >
                          {s.stage}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-gray-700 font-medium">{s.dealCount}</td>
                      <td className="py-3 px-3 text-right font-semibold text-gray-800">{inr(s.totalValue)}</td>
                      <td className="py-3 px-3 text-right text-gray-500">{inr(s.avgValue)}</td>
                      <td className="py-3 px-3 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${share}%`, background: STAGE_COLORS[s.stage] ?? '#6b7280' }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-10 text-right">{share.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold text-gray-700">
                  <td className="py-3 px-3">Total</td>
                  <td className="py-3 px-3 text-right">{metrics.forecast.totalDeals}</td>
                  <td className="py-3 px-3 text-right text-blue-700">{inr(metrics.forecast.expectedRevenue)}</td>
                  <td className="py-3 px-3 text-right text-gray-400">—</td>
                  <td className="py-3 px-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}

// ─── CSV Helpers ──────────────────────────────────────────────────────────────

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportPersonalExcel(report: PersonalReport) {
  try {
    const buffer = await generatePersonalReportExcel({
      user: report.user,
      period: report.period,
      metrics: report.metrics,
      topDeals: report.topDeals,
    });
    const uint8Array = new Uint8Array(buffer);
    const blob = new Blob([uint8Array], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `personal-report-${report.user.name.replace(/\s+/g, '-')}-${report.period.startDate}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Export failed:', error);
    alert('Failed to export report. Please try again.');
  }
}

function exportTeamCSV(report: TeamReport) {
  const { metrics, period, manager } = report;
  const rows: string[][] = [
    ['Team Performance Report'],
    ['Manager', manager.name, 'Role', manager.role],
    ['Period', `${period.startDate} to ${period.endDate}`, 'Days', String(period.days)],
    [],
    ['--- TEAM TOTALS ---'],
    ['Team Size', String(report.teamSize)],
    ['Total Revenue (INR)', String(metrics.totals.totalRevenue)],
    ['Total Leads', String(metrics.totals.totalLeads)],
    ['Total Converted', String(metrics.totals.totalConverted)],
    ['Avg Win Rate (%)', String(metrics.average.winRate)],
    [],
    ['--- TEAM LEADERBOARD ---'],
    ['Rank', 'Name', 'Role', 'Revenue (INR)', 'Leads', 'Won', 'Win Rate (%)', 'Avg Deal (INR)', 'Activities'],
    ...metrics.members.map(m => [
      String(m.rank), m.name, m.role,
      String(m.revenue), String(m.leads), String(m.converted),
      String(m.winRate.toFixed(1)), String(m.avgDealValue), String(m.activities),
    ]),
  ];
  downloadCSV(`team-report-${period.startDate}.csv`, rows);
}

function exportPipelineCSV(report: PipelineReport) {
  const { metrics, period } = report;
  const rows: string[][] = [
    ['Pipeline Health Report'],
    ['Period', `${period.startDate} to ${period.endDate}`, 'Days', String(period.days)],
    [],
    ['--- FORECAST ---'],
    ['Total Pipeline Value (INR)', String(metrics.forecast.expectedRevenue)],
    ['Total Active Deals', String(metrics.forecast.totalDeals)],
    [],
    ['--- PIPELINE BY STAGE ---'],
    ['Stage', 'Deals', 'Total Value (INR)', 'Avg Value (INR)', 'Share (%)'],
    ...metrics.stages.map(s => {
      const share = metrics.forecast.expectedRevenue > 0
        ? ((s.totalValue / metrics.forecast.expectedRevenue) * 100).toFixed(1)
        : '0';
      return [s.stage, String(s.dealCount), String(s.totalValue), String(s.avgValue), share];
    }),
  ];
  downloadCSV(`pipeline-report-${period.startDate}.csv`, rows);
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReportViewPage() {
  // Reports are admin-only; managers and sales execs are redirected away.
  useRequireRole(['SUPER_ADMIN', 'ADMIN']);
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/reports/${params.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) { setNotFound(true); return; }
        setReport(await res.json());
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [params.id]);

  // Recharts sizes its SVGs to the on-screen container; window.print() alone
  // doesn't resize them for the page. Nudge a resize, then print next frame.
  const handlePrint = () => {
    window.dispatchEvent(new Event('resize'));
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">Loading report…</p>
        </div>
      </div>
    );
  }

  if (notFound || !report) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <ReportIcon className="w-12 h-12 mx-auto text-gray-300" />
          <p className="text-gray-700 font-semibold">Report not found</p>
          <p className="text-sm text-gray-400">This report may have been deleted or you don't have access.</p>
          <button onClick={() => router.push('/reports')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            Back to Reports
          </button>
        </div>
      </div>
    );
  }

  const titleMap = {
    PERSONAL: `${(report as PersonalReport).user?.name ?? 'Performance'} Report`,
    TEAM: `Team Performance Report`,
    PIPELINE: `Pipeline Health Report`,
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6" ref={printRef}>
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 flex flex-wrap items-start justify-between gap-4 print:shadow-none">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <button onClick={() => router.push('/reports')} className="text-sm text-gray-400 hover:text-blue-600 transition-colors">
                ← Reports
              </button>
            </div>
            <h1 className="text-xl font-bold text-gray-900">{titleMap[report.reportType]}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {new Date(report.period.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              {' – '}
              {new Date(report.period.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              <span className="ml-2 text-gray-400">({report.period.days} days)</span>
            </p>
          </div>
          <div className="flex gap-2 flex-wrap print:hidden">
            <button
              onClick={() => {
                if (report.reportType === 'PERSONAL') exportPersonalExcel(report as PersonalReport);
                else if (report.reportType === 'TEAM') exportTeamCSV(report as TeamReport);
                else exportPipelineCSV(report as PipelineReport);
              }}
              className="px-3 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              Export Excel
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Export PDF
            </button>
          </div>
        </div>

        {/* Report body */}
        {report.reportType === 'PERSONAL' && <PersonalView report={report as PersonalReport} />}
        {report.reportType === 'TEAM' && <TeamView report={report as TeamReport} />}
        {report.reportType === 'PIPELINE' && <PipelineView report={report as PipelineReport} />}

      </div>
    </div>
  );
}
