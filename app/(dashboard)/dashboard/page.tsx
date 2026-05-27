'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

function getStatusColor(status: string) {
  switch (status) {
    case 'WON':         return 'bg-green-100 text-green-800';
    case 'LOST':        return 'bg-red-100 text-red-800';
    case 'NEGOTIATION': return 'bg-orange-100 text-orange-800';
    case 'PROSPECT':    return 'bg-cyan-100 text-cyan-800';
    case 'SUSPECT':     return 'bg-indigo-100 text-indigo-800';
    case 'DROPPED':     return 'bg-gray-100 text-gray-500';
    case 'ON_HOLD':     return 'bg-amber-100 text-amber-800';
    case 'REJECTED':    return 'bg-red-200 text-red-900';
    default:            return 'bg-blue-50 text-blue-700';
  }
}

function getPriorityColor(p: string) {
  switch (p) {
    case 'HIGH':   return 'text-red-600 bg-red-50';
    case 'MEDIUM': return 'text-amber-600 bg-amber-50';
    case 'LOW':    return 'text-green-600 bg-green-50';
    default:       return 'text-gray-600 bg-gray-50';
  }
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function isOverdue(date: string) {
  return new Date(date) < new Date();
}

// ─── Sales Exec Dashboard ───────────────────────────────────────────────────
function SalesExecDashboard({ data, user }: { data: any; user: any }) {
  const router = useRouter();
  const todayStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const statCards = [
    {
      label: 'My Leads',
      value: data.stats.myLeadsTotal,
      sub: `${data.stats.wonThisMonth} won this month`,
      color: 'border-blue-400 bg-blue-50',
      textColor: 'text-blue-700',
      href: '/leads',
    },
    {
      label: "Today's Follow-ups",
      value: data.stats.followUpsToday,
      sub: data.stats.followUpsToday === 0 ? 'All clear!' : 'need attention',
      color: data.stats.followUpsToday > 0 ? 'border-orange-400 bg-orange-50' : 'border-green-400 bg-green-50',
      textColor: data.stats.followUpsToday > 0 ? 'text-orange-700' : 'text-green-700',
      href: '/leads',
    },
    {
      label: 'Overdue Follow-ups',
      value: data.stats.overdueFollowUps,
      sub: data.stats.overdueFollowUps > 0 ? 'action needed' : 'all caught up',
      color: data.stats.overdueFollowUps > 0 ? 'border-red-400 bg-red-50' : 'border-green-400 bg-green-50',
      textColor: data.stats.overdueFollowUps > 0 ? 'text-red-700' : 'text-green-700',
      href: '/leads',
    },
    {
      label: 'Open Tasks',
      value: data.stats.openTasks,
      sub: data.stats.overdueTasks > 0 ? `${data.stats.overdueTasks} overdue` : 'on track',
      color: data.stats.overdueTasks > 0 ? 'border-red-400 bg-red-50' : 'border-purple-400 bg-purple-50',
      textColor: data.stats.overdueTasks > 0 ? 'text-red-700' : 'text-purple-700',
      href: '/tasks',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user.firstName}
          </h1>
          <p className="text-gray-500 mt-0.5">{todayStr}</p>
        </div>
        <Link href="/leads/new" className="btn btn-primary">+ New Lead</Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Link key={card.label} href={card.href}
            className={`card p-5 border-l-4 ${card.color} hover:shadow-md transition-shadow cursor-pointer`}
          >
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{card.label}</p>
            <p className={`text-4xl font-bold mt-1 ${card.textColor}`}>{card.value}</p>
            <p className="text-xs text-gray-500 mt-1">{card.sub}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Today's Follow-ups */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">
              Today's Follow-ups
              {data.followUpsToday.length > 0 && (
                <span className="ml-2 bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                  {data.followUpsToday.length}
                </span>
              )}
            </h2>
          </div>
          {data.followUpsToday.length === 0 ? (
            <div className="text-center py-6">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-gray-500 text-sm">No follow-ups scheduled for today</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.followUpsToday.map((lead: any) => (
                <div
                  key={lead.id}
                  onClick={() => router.push(`/leads/${lead.id}`)}
                  className="flex items-center justify-between p-3 rounded-lg bg-orange-50 border border-orange-100 cursor-pointer hover:bg-orange-100 transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm text-gray-800">{lead.name}</p>
                    <p className="text-xs text-gray-500">{lead.company} · {lead.quoteNo || '—'}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded font-semibold ${getStatusColor(lead.status)}`}>
                    {lead.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Overdue Follow-ups */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">
              Overdue Follow-ups
              {data.overdueFollowUps.length > 0 && (
                <span className="ml-2 bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                  {data.overdueFollowUps.length}
                </span>
              )}
            </h2>
          </div>
          {data.overdueFollowUps.length === 0 ? (
            <div className="text-center py-6">
              <div className="text-3xl mb-2">🎉</div>
              <p className="text-gray-500 text-sm">All follow-ups are up to date</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {data.overdueFollowUps.map((lead: any) => (
                <div
                  key={lead.id}
                  onClick={() => router.push(`/leads/${lead.id}`)}
                  className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-100 cursor-pointer hover:bg-red-100 transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm text-gray-800">{lead.name}</p>
                    <p className="text-xs text-gray-500">{lead.company}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-red-600 font-semibold">{fmt(lead.followUpDate)}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${getStatusColor(lead.status)}`}>
                      {lead.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tasks due today */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">
              Tasks Due Today
              {data.tasksToday.length > 0 && (
                <span className="ml-2 bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                  {data.tasksToday.length}
                </span>
              )}
            </h2>
            <Link href="/tasks" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          {data.tasksToday.length === 0 ? (
            <div className="text-center py-6">
              <div className="text-3xl mb-2">✓</div>
              <p className="text-gray-500 text-sm">No tasks due today</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.tasksToday.map((task: any) => (
                <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <span className={`text-xs px-2 py-0.5 rounded font-semibold ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                  </span>
                  <p className="text-sm text-gray-800 flex-1">{task.title}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming follow-ups (next 7 days) */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">Upcoming Follow-ups</h2>
            <span className="text-xs text-gray-400">Next 7 days</span>
          </div>
          {data.upcomingFollowUps.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-500 text-sm">No upcoming follow-ups this week</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {data.upcomingFollowUps.map((lead: any) => (
                <div
                  key={lead.id}
                  onClick={() => router.push(`/leads/${lead.id}`)}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm text-gray-800">{lead.name}</p>
                    <p className="text-xs text-gray-500">{lead.company}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-blue-600 font-semibold">{fmt(lead.followUpDate)}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${getStatusColor(lead.status)}`}>
                      {lead.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* My lead status breakdown + recent leads */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Status breakdown */}
        <div className="card p-5">
          <h2 className="font-bold text-gray-800 mb-4">My Leads by Status</h2>
          <div className="space-y-2">
            {data.leadsByStatus
              .sort((a: any, b: any) => b._count - a._count)
              .map((s: any) => (
                <div key={s.status} className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-1 rounded font-semibold ${getStatusColor(s.status)}`}>
                    {s.status.replace('_', ' ')}
                  </span>
                  <div className="flex items-center gap-2 flex-1 ml-3">
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-blue-400 h-2 rounded-full"
                        style={{ width: `${Math.min(100, (s._count / data.stats.myLeadsTotal) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-gray-700 w-6 text-right">{s._count}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Recently updated leads */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">Recently Updated Leads</h2>
            <Link href="/leads" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {data.recentLeads.map((lead: any) => (
              <div
                key={lead.id}
                onClick={() => router.push(`/leads/${lead.id}`)}
                className="flex items-center justify-between p-3 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-800 truncate">{lead.name}</p>
                  <p className="text-xs text-gray-500">{lead.company} · {lead.quoteNo || '—'}</p>
                </div>
                <div className="flex items-center gap-3 ml-3">
                  {lead.quoteValue && (
                    <span className="text-xs text-gray-600 font-medium">
                      ₹{Number(lead.quoteValue).toLocaleString('en-IN')}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-1 rounded font-semibold ${getStatusColor(lead.status)}`}>
                    {lead.status.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{fmt(lead.updatedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Admin / Manager Dashboard ──────────────────────────────────────────────
function AdminDashboard({ data }: { data: any }) {
  const kpis = [
    { label: 'Total Leads',     value: data.kpis.totalLeads,     icon: '🎯', href: '/leads' },
    { label: 'Customers',       value: data.kpis.totalCustomers, icon: '🏢', href: '/customers' },
    { label: 'Active Deals',    value: data.kpis.activeDeals,    icon: '📈', href: '/pipeline' },
    { label: 'Open Tickets',    value: data.kpis.openTickets,    icon: '🎫', href: '/support' },
    { label: 'Overdue Tasks',   value: data.kpis.overdueTasks,   icon: '⏰', href: '/tasks' },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="card p-5 hover:shadow-md transition-shadow cursor-pointer">
            <div className="text-3xl mb-2">{k.icon}</div>
            <p className="text-2xl font-bold">{k.value}</p>
            <p className="text-xs text-gray-500 mt-1">{k.label}</p>
          </Link>
        ))}
      </div>

      {/* Pipeline by stage */}
      {data.pipeline && data.pipeline.length > 0 && (
        <div className="card p-6">
          <h2 className="font-bold text-gray-800 mb-4">Pipeline by Stage</h2>
          <div className="space-y-3">
            {data.pipeline
              .sort((a: any, b: any) => Number(b.value) - Number(a.value))
              .map((s: any) => (
                <div key={s.stage} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-600 w-28 shrink-0">{s.stage}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-3">
                    <div
                      className="bg-blue-500 h-3 rounded-full"
                      style={{
                        width: `${Math.min(100, (Number(s.value) / Math.max(...data.pipeline.map((x: any) => Number(x.value)), 1)) * 100)}%`
                      }}
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-700 w-24 text-right">
                    ₹{Number(s.value).toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs text-gray-400 w-16 text-right">{s.count} deals</span>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="card p-6">
        <h2 className="font-bold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link href="/leads/new"     className="btn btn-primary text-center">+ New Lead</Link>
          <Link href="/customers/new" className="btn btn-primary text-center">+ New Customer</Link>
          <Link href="/pipeline"      className="btn btn-secondary text-center">View Pipeline</Link>
          <Link href="/users"         className="btn btn-secondary text-center">Manage Users</Link>
        </div>
      </div>
    </div>
  );
}

// ─── Page entry ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login'; return; }

    Promise.all([
      fetch('/api/auth/me',           { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/reports/dashboard', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([me, dash]) => {
      setUser(me);
      setData(dash);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  if (!data || !user) return null;

  if (user.role === 'SALES_EXEC') {
    return <SalesExecDashboard data={data} user={user} />;
  }

  return <AdminDashboard data={data} />;
}
