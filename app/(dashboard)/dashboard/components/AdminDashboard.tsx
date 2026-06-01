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
  APPROACH: 'bg-yellow-100 text-yellow-700',
  NEGOTIATION: 'bg-orange-100 text-orange-700',
  CLOSURE: 'bg-green-100 text-green-700',
  ONGOING: 'bg-blue-100 text-blue-700',
};

export default function AdminDashboard({ data }: { data: any }) {
  const { kpis, pipeline, recentActivity } = data;
  const revenueGrowth = kpis.lastMonthRevenue > 0
    ? (((kpis.monthRevenue - kpis.lastMonthRevenue) / kpis.lastMonthRevenue) * 100).toFixed(1)
    : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-500">Company-wide overview</p>
        </div>
        <div className="flex gap-2">
          <Link href="/reports" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            View Reports
          </Link>
          <Link href="/users" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
            Manage Users
          </Link>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Leads" value={fmtNum(kpis.totalLeads)} color="text-blue-600" href="/leads" />
        <KpiCard label="Total Customers" value={fmtNum(kpis.totalCustomers)} color="text-green-600" href="/customers" />
        <KpiCard label="Active Deals" value={fmtNum(kpis.activeDeals)} color="text-purple-600" href="/pipeline" />
        <KpiCard label="Pipeline Value" value={fmt(kpis.dealsPipelineValue)} color="text-indigo-600" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="This Month Revenue"
          value={fmt(kpis.monthRevenue)}
          sub={revenueGrowth ? `${revenueGrowth}% vs last month` : undefined}
          color={revenueGrowth && Number(revenueGrowth) >= 0 ? 'text-green-600' : 'text-red-600'}
        />
        <KpiCard label="Open Tickets" value={kpis.openTickets} color="text-red-600" href="/support" />
        <KpiCard label="Overdue Tasks" value={kpis.overdueTasks} color="text-orange-600" href="/tasks" />
        <KpiCard label="Pending Approvals" value={kpis.pendingApprovals} color="text-yellow-600" href="/approvals" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <KpiCard label="Active Users" value={kpis.totalUsers} color="text-gray-700" href="/users" />
      </div>

      {/* Pipeline breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Pipeline by Stage</h2>
          {pipeline.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No deals in pipeline yet</p>
          ) : (
            <div className="space-y-3">
              {pipeline.map((p: any) => (
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: '/announcements', label: 'Announcements', icon: '📢' },
            { href: '/attendance', label: 'Attendance', icon: '📅' },
            { href: '/settings', label: 'Settings', icon: '⚙️' },
            { href: '/reports/team', label: 'Team Report', icon: '👥' },
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
