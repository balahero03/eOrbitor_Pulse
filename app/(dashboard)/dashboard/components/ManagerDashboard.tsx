'use client';

import Link from 'next/link';

const fmt = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

function StatCard({ label, value, color, href }: { label: string; value: string | number; color: string; href?: string }) {
  const inner = (
    <div className={`bg-white rounded-xl border p-5 shadow-sm hover:shadow-md transition-shadow ${href ? 'cursor-pointer' : ''}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

const STATUS_COLORS: Record<string, string> = {
  WON: 'bg-green-100 text-green-700',
  LOST: 'bg-red-100 text-red-700',
  SUSPECT: 'bg-indigo-100 text-indigo-700',
  PROSPECT: 'bg-cyan-100 text-cyan-700',
  NEGOTIATION: 'bg-orange-100 text-orange-700',
  ON_HOLD: 'bg-amber-100 text-amber-700',
  DROPPED: 'bg-gray-100 text-gray-500',
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

export default function ManagerDashboard({ data }: { data: any }) {
  const { stats, teamMembers, leaderboard, pipeline, recentLeads, announcements } = data;

  return (
    <div className="p-6 space-y-6">
      {/* Announcements at the top */}
      <AnnouncementsPanel announcements={announcements} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manager Dashboard</h1>
          <p className="text-sm text-gray-500">{data.teamName}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/reports" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            Reports
          </Link>
          <Link href="/team-activity" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
            Team Activity
          </Link>
        </div>
      </div>

      {/* Team KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Team Leads" value={stats.teamLeads} color="text-blue-600" href="/leads" />
        <StatCard label="Team Active Deals" value={stats.teamDeals} color="text-purple-600" />
        <StatCard label="Won This Month" value={stats.teamWonThisMonth} color="text-green-600" />
        <StatCard label="Open Tasks" value={stats.teamOpenTasks} color="text-gray-700" href="/tasks" />
        <StatCard label="Overdue Tasks" value={stats.teamOverdueTasks} color="text-red-600" href="/tasks" />
        <StatCard label="Overdue Follow-ups" value={stats.teamFollowUpsOverdue} color="text-orange-600" href="/leads" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Team Leaderboard */}
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">Team Leaderboard (This Month)</h2>
            <Link href="/reports/team" className="text-xs text-blue-600 hover:underline">Full report</Link>
          </div>
          {(!leaderboard || leaderboard.length === 0) ? (
            <p className="text-sm text-gray-400 text-center py-4">No team members yet</p>
          ) : (
            <div className="space-y-3">
              {leaderboard
                .sort((a: any, b: any) => b.wonThisMonth - a.wonThisMonth)
                .map((m: any, i: number) => (
                  <div key={m.userId} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      i === 0 ? 'bg-yellow-100 text-yellow-700' :
                      i === 1 ? 'bg-gray-100 text-gray-600' :
                      i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-500'
                    }`}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{m.name}</p>
                      <p className="text-xs text-gray-500">{m.activeLeads} active leads · {fmt(m.pipelineValue)} pipeline</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-green-600">{m.wonThisMonth} won</p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Pipeline */}
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">Team Pipeline</h2>
          </div>
          {(!pipeline || pipeline.length === 0) ? (
            <p className="text-sm text-gray-400 text-center py-4">No deals in pipeline</p>
          ) : (
            <div className="space-y-3">
              {pipeline.map((p: any) => (
                <div key={p.stage} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{p.stage}</span>
                    <span className="text-sm text-gray-500">{p.count} deal{p.count !== 1 ? 's' : ''}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-800">{fmt(p.value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Leads */}
      <div className="bg-white rounded-xl border p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800">Recent Team Leads</h2>
          <Link href="/leads" className="text-xs text-blue-600 hover:underline">View all</Link>
        </div>
        {(!recentLeads || recentLeads.length === 0) ? (
          <p className="text-sm text-gray-400 text-center py-4">No leads yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-xs font-medium text-gray-500">Lead</th>
                  <th className="text-left py-2 text-xs font-medium text-gray-500">Company</th>
                  <th className="text-left py-2 text-xs font-medium text-gray-500">Status</th>
                  <th className="text-left py-2 text-xs font-medium text-gray-500">Assigned</th>
                </tr>
              </thead>
              <tbody>
                {recentLeads.map((l: any) => (
                  <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2">
                      <Link href={`/leads/${l.id}`} className="font-medium text-blue-600 hover:underline">{l.name}</Link>
                    </td>
                    <td className="py-2 text-gray-600">{l.company}</td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[l.status] || 'bg-gray-100 text-gray-600'}`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="py-2 text-gray-500">
                      {l.assignedTo?.firstName} {l.assignedTo?.lastName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: '/leads/new', label: 'New Lead', icon: '➕' },
            { href: '/approvals', label: 'Approvals', icon: '✅' },
            { href: '/team-activity', label: 'Team Activity', icon: '👥' },
            { href: '/reports/sales', label: 'Sales Report', icon: '📊' },
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
