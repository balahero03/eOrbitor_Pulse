'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useRequireRole } from '@/lib/hooks/useRequireRole';
import { ReportIcon } from '@/components/icons';
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
      totalLoggedHours: number; totalActivityHours: number; totalUnproductiveHours: number;
      unproductiveDays: number; daysPresent: number;
      dailyBreakdown: { date: string; loggedHours: number; activityHours: number; unproductiveHours: number; activityCount: number }[];
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

function PersonalView({ report }: { report: PersonalReport }) {
  const { metrics, topDeals } = report;

  const byMonthData = metrics.revenue.byMonth;
  const byStatusData = Object.entries(metrics.leads.byStatus)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
  const bySourcePie = Object.entries(metrics.revenue.bySource)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));
  const conversionTable = Object.entries(metrics.conversion.bySource)
    .sort((a, b) => b[1].total - a[1].total);

  const perfBreakdown = [
    { label: 'Win Rate', score: metrics.performance.breakdown.winRate, max: 30, color: 'bg-blue-500' },
    { label: 'Revenue', score: metrics.performance.breakdown.revenue, max: 40, color: 'bg-green-500' },
    { label: 'Activity', score: metrics.performance.breakdown.activity, max: 20, color: 'bg-orange-500' },
    { label: 'Leads', score: metrics.performance.breakdown.leads, max: 10, color: 'bg-purple-500' },
  ];

  return (
    <>
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total Leads" value={metrics.leads.total} sub={`${metrics.leads.converted} converted`} />
        <MetricCard label="Win Rate" value={`${metrics.conversion.winRate}%`} sub={`Conversion: ${metrics.conversion.conversionRate}%`} accent="text-blue-600" />
        <MetricCard label="Total Revenue" value={inrShort(metrics.revenue.total)} sub={`Pipeline: ${inrShort(metrics.revenue.pipeline)}`} accent="text-green-600" />
        <MetricCard label="Avg Deal Value" value={inrShort(metrics.revenue.average)} sub={`${topDeals.length} deals won`} />
      </div>

      {/* Period-over-period comparison */}
      {metrics.comparison && (
        <div className="mb-6">
          <SectionCard title={`vs Previous Period (${new Date(metrics.comparison.previousPeriod.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${new Date(metrics.comparison.previousPeriod.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})`}>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { key: 'revenue', label: 'Revenue', fmt: (v: number) => inrShort(v) },
                { key: 'leads', label: 'Leads', fmt: (v: number) => String(v) },
                { key: 'converted', label: 'Converted', fmt: (v: number) => String(v) },
                { key: 'winRate', label: 'Win Rate', fmt: (v: number) => `${v}%` },
                { key: 'activities', label: 'Activities', fmt: (v: number) => String(v) },
              ].map(({ key, label, fmt }) => {
                const m = metrics.comparison!.metrics[key as keyof typeof metrics.comparison.metrics];
                return (
                  <div key={key} className="text-center">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">{fmt(m.current)}</p>
                    <div className="mt-1 flex items-center justify-center gap-1">
                      <DeltaBadge pct={m.deltaPct} />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">was {fmt(m.previous)}</p>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      )}

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <SectionCard title="Revenue Over Time">
          {byMonthData.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={byMonthData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => inrShort(v)} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => inr(v)} />
                <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard title="Revenue by Source">
          {bySourcePie.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={bySourcePie}
                  cx="50%" cy="50%"
                  outerRadius={90}
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
          )}
        </SectionCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <SectionCard title="Leads by Status">
          {byStatusData.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byStatusData} margin={{ top: 4, right: 8, left: 0, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="status" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard title="Performance Score">
          <div className="flex items-center gap-4 mb-5">
            <div className="relative w-24 h-24 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="3"
                  strokeDasharray={`${metrics.performance.score} ${100 - metrics.performance.score}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold text-gray-900">{metrics.performance.score}</span>
              </div>
            </div>
            <div className="flex-1 space-y-3">
              {perfBreakdown.map(p => (
                <div key={p.label}>
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>{p.label}</span>
                    <span className="font-medium">{p.score.toFixed(1)}/{p.max}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${p.color} rounded-full`} style={{ width: `${(p.score / p.max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Top Deals */}
      <SectionCard title="Top Deals Won">
        {topDeals.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">No deals won in this period</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">#</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Deal</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Value</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Closed</th>
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
        )}
      </SectionCard>

      {/* Daily Activity & Unproductive Hours */}
      {metrics.dailyActivity && (() => {
        const da = metrics.dailyActivity;
        const prodPct = da.totalLoggedHours > 0
          ? Math.round((da.totalActivityHours / da.totalLoggedHours) * 100)
          : 0;
        return (
          <div className="mt-5">
            <SectionCard title="Attendance & Productivity">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700">{da.daysPresent}</p>
                  <p className="text-xs text-blue-600 mt-1">Days Present</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{da.totalLoggedHours}h</p>
                  <p className="text-xs text-green-600 mt-1">Total Logged Hours</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-purple-700">{da.totalActivityHours}h</p>
                  <p className="text-xs text-purple-600 mt-1">Activity-Covered Hours</p>
                </div>
                <div className={`rounded-lg p-3 text-center ${da.totalUnproductiveHours > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <p className={`text-2xl font-bold ${da.totalUnproductiveHours > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                    {da.totalUnproductiveHours}h
                  </p>
                  <p className={`text-xs mt-1 ${da.totalUnproductiveHours > 0 ? 'text-red-500' : 'text-gray-500'}`}>
                    Unproductive Hours
                  </p>
                </div>
              </div>

              {/* Productivity bar */}
              <div className="mb-5">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Productivity Rate</span>
                  <span className={`font-bold ${prodPct >= 70 ? 'text-green-600' : prodPct >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {prodPct}%
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${prodPct >= 70 ? 'bg-green-500' : prodPct >= 40 ? 'bg-yellow-400' : 'bg-red-500'}`}
                    style={{ width: `${prodPct}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">{da.unproductiveDays} day(s) with &gt;30 min unaccounted time</p>
              </div>

              {/* Daily breakdown table */}
              {da.dailyBreakdown.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Date</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Logged</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Activity Covered</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Unproductive</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Entries</th>
                      </tr>
                    </thead>
                    <tbody>
                      {da.dailyBreakdown.map((d: any) => (
                        <tr key={d.date} className={`border-b border-gray-50 hover:bg-gray-50 ${d.unproductiveHours > 0.5 ? 'bg-red-50/40' : ''}`}>
                          <td className="py-2.5 px-3 text-gray-700">
                            {new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </td>
                          <td className="py-2.5 px-3 text-right text-gray-600">{d.loggedHours}h</td>
                          <td className="py-2.5 px-3 text-right text-green-700">{d.activityHours}h</td>
                          <td className="py-2.5 px-3 text-right">
                            {d.unproductiveHours > 0.5 ? (
                              <span className="text-red-600 font-semibold">{d.unproductiveHours}h</span>
                            ) : (
                              <span className="text-gray-400">{d.unproductiveHours}h</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right text-gray-500">{d.activityCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </div>
        );
      })()}

      {/* Conversion by source + Sales cycle */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
        <SectionCard title="Conversion by Source">
          {conversionTable.length === 0 ? <EmptyChart /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Source</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Leads</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Won</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Rate</th>
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
          )}
        </SectionCard>

        <SectionCard title="Sales Cycle & Activity">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">{metrics.salesCycle.avgDuration}</p>
              <p className="text-xs text-blue-600 mt-1">Avg Days to Close</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-purple-700">{metrics.salesCycle.median}</p>
              <p className="text-xs text-purple-600 mt-1">Median Sales Cycle</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-700">{metrics.activities.followupsCompleted}</p>
              <p className="text-xs text-green-600 mt-1">Follow-ups Done</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-orange-700">{metrics.activities.tasksCompleted}</p>
              <p className="text-xs text-orange-600 mt-1">Tasks Completed</p>
            </div>
          </div>
          <div className="mt-4 bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-3xl font-bold text-gray-800">{metrics.activities.total}</p>
            <p className="text-xs text-gray-500 mt-1">Total Activity Log Entries</p>
          </div>
        </SectionCard>
      </div>

      {/* Own pipeline funnel + Follow-up punctuality */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
        {metrics.pipeline && (
          <SectionCard title="Own Pipeline">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-blue-700">{metrics.pipeline.totalDeals}</p>
                <p className="text-xs text-blue-600 mt-1">Active Deals</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-gray-800">{inrShort(metrics.pipeline.totalValue)}</p>
                <p className="text-xs text-gray-500 mt-1">Total Value</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-green-700">{inrShort(metrics.pipeline.weightedForecast)}</p>
                <p className="text-xs text-green-600 mt-1">Weighted Forecast</p>
              </div>
            </div>
            {metrics.pipeline.stages.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No active deals</p>
            ) : (
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
                  {metrics.pipeline.stages.map(s => (
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
            )}
          </SectionCard>
        )}

        {metrics.followUpPunctuality && (
          <SectionCard title="Follow-up Punctuality">
            <div className="flex items-center gap-4 mb-5">
              <div className="relative w-24 h-24 flex-shrink-0">
                <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.9" fill="none"
                    stroke={metrics.followUpPunctuality.onTimeRate >= 70 ? '#10b981' : metrics.followUpPunctuality.onTimeRate >= 40 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="3"
                    strokeDasharray={`${metrics.followUpPunctuality.onTimeRate} ${100 - metrics.followUpPunctuality.onTimeRate}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-gray-900">{metrics.followUpPunctuality.onTimeRate}%</span>
                </div>
              </div>
              <div className="flex-1 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Completed</span><span className="font-semibold text-gray-800">{metrics.followUpPunctuality.completed}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">On time</span><span className="font-semibold text-green-700">{metrics.followUpPunctuality.onTime}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Late</span><span className="font-semibold text-red-600">{metrics.followUpPunctuality.late}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Avg delay</span><span className="font-semibold text-gray-800">{metrics.followUpPunctuality.avgDelayDays} days</span></div>
              </div>
            </div>
          </SectionCard>
        )}
      </div>

      {/* Loss analysis */}
      {metrics.lossAnalysis && metrics.lossAnalysis.totalLost > 0 && (
        <div className="mt-5">
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
        </div>
      )}
    </>
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
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Logged Hrs</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Unproductive</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Productivity</th>
                </tr>
              </thead>
              <tbody>
                {metrics.members.map((m: any) => {
                  const da = m.dailyActivity;
                  const prodPct = da && da.totalLoggedHours > 0
                    ? Math.round((da.totalActivityHours / da.totalLoggedHours) * 100)
                    : null;
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
                      <td className="py-3 px-3 text-right">
                        {da ? (
                          da.totalUnproductiveHours > 0.5
                            ? <span className="text-red-600 font-semibold">{da.totalUnproductiveHours}h</span>
                            : <span className="text-gray-400">{da.totalUnproductiveHours}h</span>
                        ) : '—'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {prodPct !== null ? (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            prodPct >= 70 ? 'bg-green-100 text-green-700' :
                            prodPct >= 40 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>{prodPct}%</span>
                        ) : '—'}
                      </td>
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
                  <td className="py-3 px-3" colSpan={3} />
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

function exportPersonalCSV(report: PersonalReport) {
  const { metrics, topDeals, period, user } = report;
  const rows: string[][] = [
    ['Personal Performance Report'],
    ['User', user.name, 'Role', user.role],
    ['Period', `${period.startDate} to ${period.endDate}`, 'Days', String(period.days)],
    [],
    ['--- KEY METRICS ---'],
    ['Total Leads', String(metrics.leads.total)],
    ['Converted Leads', String(metrics.leads.converted)],
    ['Win Rate (%)', String(metrics.conversion.winRate)],
    ['Conversion Rate (%)', String(metrics.conversion.conversionRate)],
    ['Total Revenue (INR)', String(metrics.revenue.total)],
    ['Pipeline Value (INR)', String(metrics.revenue.pipeline)],
    ['Avg Deal Value (INR)', String(metrics.revenue.average)],
    ['Activities Logged', String(metrics.activities.total)],
    ['Follow-ups Completed', String(metrics.activities.followupsCompleted)],
    ['Tasks Completed', String(metrics.activities.tasksCompleted)],
    ['Avg Days to Close', String(metrics.salesCycle.avgDuration)],
    ['Performance Score', String(metrics.performance.score)],
    [],
    ['--- REVENUE BY MONTH ---'],
    ['Month', 'Revenue (INR)'],
    ...metrics.revenue.byMonth.map(r => [r.month, String(r.revenue)]),
    [],
    ['--- TOP DEALS ---'],
    ['Deal Name', 'Value (INR)', 'Closed Date', 'Status'],
    ...topDeals.map(d => [d.dealName, String(d.value), d.closedDate, d.status]),
    [],
    ['--- CONVERSION BY SOURCE ---'],
    ['Source', 'Total Leads', 'Won', 'Win Rate (%)'],
    ...Object.entries(metrics.conversion.bySource).map(([src, d]) => [src, String(d.total), String(d.won), String(d.rate.toFixed(1))]),
    ...(metrics.comparison ? [
      [],
      ['--- VS PREVIOUS PERIOD ---'],
      ['Metric', 'Current', 'Previous', 'Change (%)'],
      ...(['revenue', 'leads', 'converted', 'winRate', 'activities'] as const).map(k => {
        const m = metrics.comparison!.metrics[k];
        return [k, String(m.current), String(m.previous), String(m.deltaPct)];
      }),
    ] : []),
    ...(metrics.followUpPunctuality ? [
      [],
      ['--- FOLLOW-UP PUNCTUALITY ---'],
      ['Completed', String(metrics.followUpPunctuality.completed)],
      ['On Time', String(metrics.followUpPunctuality.onTime)],
      ['Late', String(metrics.followUpPunctuality.late)],
      ['On-Time Rate (%)', String(metrics.followUpPunctuality.onTimeRate)],
      ['Avg Delay (days)', String(metrics.followUpPunctuality.avgDelayDays)],
    ] : []),
    ...(metrics.pipeline ? [
      [],
      ['--- OWN PIPELINE ---'],
      ['Stage', 'Deals', 'Total Value (INR)', 'Weighted (INR)'],
      ...metrics.pipeline.stages.map(s => [s.stage, String(s.dealCount), String(s.totalValue), String(s.weightedValue)]),
      ['Weighted Forecast (INR)', String(metrics.pipeline.weightedForecast)],
    ] : []),
    ...(metrics.lossAnalysis && metrics.lossAnalysis.totalLost > 0 ? [
      [],
      ['--- LOSS ANALYSIS ---'],
      ['Lost', String(metrics.lossAnalysis.lostCount), 'Dropped', String(metrics.lossAnalysis.droppedCount), 'Lost Value (INR)', String(metrics.lossAnalysis.lostValue)],
      ['Reason', 'Count', 'Value (INR)'],
      ...metrics.lossAnalysis.byReason.map(r => [r.reason, String(r.count), String(r.lostValue)]),
    ] : []),
  ];
  downloadCSV(`personal-report-${user.name.replace(/\s+/g, '-')}-${period.startDate}.csv`, rows);
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
                if (report.reportType === 'PERSONAL') exportPersonalCSV(report as PersonalReport);
                else if (report.reportType === 'TEAM') exportTeamCSV(report as TeamReport);
                else exportPipelineCSV(report as PipelineReport);
              }}
              className="px-3 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              Export CSV
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
