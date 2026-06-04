'use client';

import Link from 'next/link';

const fmt = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

const fmtNum = (v: number) =>
  new Intl.NumberFormat('en-IN').format(v);

function KpiCard({
  label, value, sub, color, href,
}: { label: string; value: string | number; sub?: string; color: string; href?: string }) {
  const inner = (
    <div className={`bg-white rounded-xl border p-5 shadow-sm hover:shadow-md transition-shadow ${href ? 'cursor-pointer' : ''}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

const STAGE_COLORS: Record<string, string> = {
  SUSPECT: 'bg-indigo-100 text-indigo-700',
  PROSPECT: 'bg-cyan-100 text-cyan-700',
  PROPOSAL: 'bg-yellow-100 text-yellow-700',
  NEGOTIATION: 'bg-orange-100 text-orange-700',
  CLOSURE: 'bg-green-100 text-green-700',
  ONGOING: 'bg-blue-100 text-blue-700',
};

const PRIORITY_STYLE: Record<string, string> = {
  HIGH:   'border-red-400 bg-red-50',
  NORMAL: 'border-blue-200 bg-blue-50',
  LOW:    'border-gray-200 bg-gray-50',
};
const PRIORITY_BADGE: Record<string, string> = {
  HIGH:   'bg-red-100 text-red-700',
  NORMAL: 'bg-blue-100 text-blue-700',
  LOW:    'bg-gray-100 text-gray-500',
};

function AnnouncementsPanel({ announcements }: { announcements: any[] }) {
  if (!announcements?.length) return null;
  return (
    <div className="bg-white rounded-xl border p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-800 mb-4">📢 Announcements</h2>
      <div className="space-y-3">
        {announcements.map((a: any) => (
          <div key={a.id} className={`rounded-lg border-l-4 px-4 py-3 ${PRIORITY_STYLE[a.priority] || PRIORITY_STYLE.NORMAL}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900">{a.title}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${PRIORITY_BADGE[a.priority] || PRIORITY_BADGE.NORMAL}`}>
                {a.priority}
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1">{a.content}</p>
            {a.publishedAt && (
              <p className="text-[10px] text-gray-400 mt-1">
                {new Date(a.publishedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard({ data }: { data: any }) {
  const { kpis, pipeline, recentActivity, announcements } = data;
  const revenueGrowth = (kpis?.lastMonthRevenue && kpis.lastMonthRevenue > 0)
    ? (((kpis?.monthRevenue - kpis.lastMonthRevenue) / kpis.lastMonthRevenue) * 100).toFixed(1)
    : null;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Announcements at the top */}
      <AnnouncementsPanel announcements={announcements} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-500">Company-wide overview</p>
        </div>
        <div className="flex gap-2">
          <Link href="/users" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
            Manage Users
          </Link>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Total Leads" value={fmtNum(kpis?.totalLeads || 0)} color="text-blue-600" href="/leads" />
        <KpiCard label="Active Deals" value={fmtNum(kpis?.activeDeals || 0)} color="text-purple-600" />
        <KpiCard label="Pipeline Value" value={fmt(kpis?.dealsPipelineValue || 0)} color="text-indigo-600" />
        <KpiCard
          label="This Month Revenue"
          value={fmt(kpis?.monthRevenue || 0)}
          sub={revenueGrowth ? `${revenueGrowth}% vs last month` : undefined}
          color={revenueGrowth && Number(revenueGrowth) >= 0 ? 'text-green-600' : 'text-red-600'}
        />
        <KpiCard label="Overdue Tasks" value={kpis?.overdueTasks || 0} color="text-orange-600" href="/tasks" />
        <KpiCard label="Pending Approvals" value={kpis?.pendingApprovals || 0} color="text-yellow-600" href="/approvals" />
        <KpiCard label="Active Users" value={kpis?.totalUsers || 0} color="text-gray-700" href="/users" />
      </div>

      {/* Pipeline breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Pipeline by Stage</h2>
          {(pipeline || []).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No deals in pipeline yet</p>
          ) : (
            <div className="space-y-3">
              {(pipeline || []).map((p: any) => (
                <div key={p.stage} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_COLORS[p.stage] || 'bg-gray-100 text-gray-600'}`}>
                      {p.stage}
                    </span>
                    <span className="text-sm text-gray-500">{p.count} deal{p.count !== 1 ? 's' : ''}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-800">{fmt(p.value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Recent Activity</h2>
          {recentActivity?.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No recent activity</p>
          ) : (
            <div className="space-y-2">
              {(recentActivity || []).map((a: any) => (
                <div key={a.id} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">{a.action}</span>
                  <span className="text-sm text-gray-600">{a.entity}</span>
                  <span className="text-xs text-gray-400 ml-auto">
                    {new Date(a.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="bg-white rounded-xl border p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { href: '/announcements', label: 'Announcements', icon: '📢' },
            { href: '/attendance', label: 'Attendance', icon: '📅' },
            { href: '/settings', label: 'Settings', icon: '⚙️' },
          ].map((item) => (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-2 px-4 py-3 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
