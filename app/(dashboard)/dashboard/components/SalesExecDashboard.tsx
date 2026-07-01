'use client';

import Link from 'next/link';

const fmt = (v: number | string) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(v) || 0);

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

const isOverdue = (d: string) => new Date(d) < new Date();

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-slate-100 text-slate-700',
  CONTACTED: 'bg-blue-100 text-blue-700',
  QUALIFIED: 'bg-teal-100 text-teal-700',
  WON: 'bg-green-100 text-green-700',
  LOST: 'bg-red-100 text-red-700',
  SUSPECT: 'bg-indigo-100 text-indigo-700',
  PROSPECT: 'bg-cyan-100 text-cyan-700',
  APPROACH: 'bg-sky-100 text-sky-700',
  PROPOSAL: 'bg-yellow-100 text-yellow-700',
  NEGOTIATION: 'bg-orange-100 text-orange-700',
  CLOSURE: 'bg-emerald-100 text-emerald-700',
  ORDER: 'bg-green-100 text-green-700',
  CONVERTED: 'bg-green-100 text-green-700',
  ON_HOLD: 'bg-amber-100 text-amber-700',
  DROPPED: 'bg-gray-100 text-gray-500',
  REJECTED: 'bg-red-200 text-red-800',
};

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700',
  HIGH: 'bg-orange-100 text-orange-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  LOW: 'bg-gray-100 text-gray-600',
};

function StatCard({ label, value, color, alert, href }: {
  label: string; value: string | number; color: string; alert?: boolean; href?: string;
}) {
  const inner = (
    <div className={`bg-white rounded-xl border p-4 shadow-sm hover:shadow-md transition-shadow ${alert && Number(value) > 0 ? 'border-red-200' : ''} ${href ? 'cursor-pointer' : ''}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

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

export default function SalesExecDashboard({ data }: { data: any }) {
  const { stats, followUpsToday, overdueFollowUps, tasksToday, recentLeads, upcomingFollowUps, leadsByStatus, announcements } = data;

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Announcements at the top */}
      <AnnouncementsPanel announcements={announcements} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Dashboard</h1>
          <p className="text-sm text-gray-500">{today}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/leads/new" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            + New Lead
          </Link>
          <Link href="/daily-activity" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
            Log Activity
          </Link>
        </div>
      </div>

      {/* Personal KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="My Leads" value={stats.myLeadsTotal} color="text-blue-600" href="/leads" />
        <StatCard label="Won This Month" value={stats.wonThisMonth} color="text-green-600" />
        <StatCard label="Follow-ups Today" value={stats.followUpsToday} color={stats.followUpsToday > 0 ? 'text-blue-600' : 'text-gray-400'} />
        <StatCard label="Overdue Follow-ups" value={stats.overdueFollowUps} color={stats.overdueFollowUps > 0 ? 'text-red-600' : 'text-gray-400'} alert href="/leads" />
        <StatCard label="Open Tasks" value={stats.openTasks} color="text-gray-700" href="/tasks" />
        <StatCard label="Overdue Tasks" value={stats.overdueTasks} color={stats.overdueTasks > 0 ? 'text-red-600' : 'text-gray-400'} alert href="/tasks" />
      </div>

      {/* Today's Follow-ups + Overdue */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Today's Follow-ups */}
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">Follow-ups Today</h2>
            <Link href="/leads" className="text-xs text-blue-600 hover:underline">All leads</Link>
          </div>
          {followUpsToday.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No follow-ups scheduled today</p>
          ) : (
            <div className="space-y-2">
              {followUpsToday.map((l: any) => (
                <Link href={`/leads/${l.id}`} key={l.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-blue-50 transition-colors border border-gray-100">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{l.name}</p>
                    <p className="text-xs text-gray-500 truncate">{l.company}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[l.status] || 'bg-gray-100 text-gray-600'}`}>
                      {l.status}
                    </span>
                    {l.followUpDate && (
                      <span className="text-xs text-gray-400">{fmtDate(l.followUpDate)}</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Overdue Follow-ups */}
        <div className="bg-white rounded-xl border border-red-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">Overdue Follow-ups</h2>
            {overdueFollowUps.length > 0 && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                {overdueFollowUps.length} overdue
              </span>
            )}
          </div>
          {overdueFollowUps.length === 0 ? (
            <p className="text-sm text-green-600 text-center py-6 font-medium">All caught up!</p>
          ) : (
            <div className="space-y-2">
              {overdueFollowUps.map((l: any) => (
                <Link href={`/leads/${l.id}`} key={l.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-red-50 transition-colors border border-red-50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{l.name}</p>
                    <p className="text-xs text-gray-500 truncate">{l.company}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[l.status] || 'bg-gray-100 text-gray-600'}`}>
                      {l.status}
                    </span>
                    {l.followUpDate && (
                      <span className="text-xs text-red-500 font-medium">{fmtDate(l.followUpDate)}</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tasks Due Today */}
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">Tasks Due Today</h2>
            <Link href="/tasks" className="text-xs text-blue-600 hover:underline">All tasks</Link>
          </div>
          {tasksToday.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No tasks due today</p>
          ) : (
            <div className="space-y-2">
              {tasksToday.map((t: any) => (
                <Link href={`/tasks/${t.id}`} key={t.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100">
                  <p className="text-sm font-medium text-gray-800 truncate flex-1">{t.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 flex-shrink-0 ${PRIORITY_COLORS[t.priority] || 'bg-gray-100 text-gray-600'}`}>
                    {t.priority}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* My Lead Status Breakdown */}
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">My Leads by Status</h2>
            <Link href="/leads" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          {leadsByStatus.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No leads yet</p>
          ) : (
            <div className="space-y-2">
              {[...leadsByStatus]
                .sort((a: any, b: any) => b._count - a._count)
                .map((s: any) => (
                  <div key={s.status} className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.status] || 'bg-gray-100 text-gray-600'}`}>
                      {s.status}
                    </span>
                    <span className="text-sm font-semibold text-gray-700">{s._count}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Leads */}
      <div className="bg-white rounded-xl border p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800">Recently Updated Leads</h2>
          <Link href="/leads" className="text-xs text-blue-600 hover:underline">All leads</Link>
        </div>
        {recentLeads.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No leads yet. <Link href="/leads/new" className="text-blue-600 hover:underline">Create your first lead</Link></p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-xs font-medium text-gray-500">Lead</th>
                  <th className="text-left py-2 text-xs font-medium text-gray-500">Company</th>
                  <th className="text-left py-2 text-xs font-medium text-gray-500">Status</th>
                  <th className="text-right py-2 text-xs font-medium text-gray-500">Quote Value</th>
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
                    <td className="py-2 text-right text-gray-700 font-medium">
                      {l.quoteValue ? fmt(l.quoteValue) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
