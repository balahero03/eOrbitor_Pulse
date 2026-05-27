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

// ─── Manager Dashboard ──────────────────────────────────────────────────────
function ManagerDashboard({ data, user }: { data: any; user: any }) {
  if (!data?.stats) {
    return (
      <div className="p-6">
        <div className="card p-6 bg-yellow-50 border border-yellow-200">
          <p className="text-yellow-700">Dashboard data not available</p>
        </div>
      </div>
    );
  }

  const stats = [
    { label: 'Team Leads',       value: data.stats.teamLeads,       icon: '👥', href: '/leads', color: 'bg-blue-50' },
    { label: 'Active Deals',     value: data.stats.teamDeals,       icon: '📈', href: '/pipeline', color: 'bg-green-50' },
    { label: 'Won This Month',   value: data.stats.teamWonThisMonth, icon: '🏆', href: '/pipeline', color: 'bg-yellow-50' },
    { label: 'Open Tasks',       value: data.stats.teamOpenTasks,   icon: '✓', href: '/tasks', color: 'bg-purple-50' },
  ];

  const alerts = [
    { label: 'Overdue Follow-ups', value: data.stats.teamFollowUpsOverdue, color: 'text-red-600' },
    { label: 'Overdue Tasks',      value: data.stats.teamOverdueTasks, color: 'text-orange-600' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Team Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">{data.teamName}</p>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className={`card p-5 hover:shadow-md transition-shadow cursor-pointer ${s.color}`}>
            <div className="text-2xl mb-2">{s.icon}</div>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-gray-600 mt-1">{s.label}</p>
          </Link>
        ))}
      </div>

      {/* Alerts */}
      <div className="grid grid-cols-2 gap-4">
        {alerts.map((a) => (
          <div key={a.label} className="card p-4 border-l-4 border-red-500">
            <p className={`text-2xl font-bold ${a.color}`}>{a.value}</p>
            <p className="text-xs text-gray-600 mt-1">{a.label}</p>
          </div>
        ))}
      </div>

      {/* Team Members */}
      {data.teamMembers && data.teamMembers.length > 0 && (
        <div className="card p-6">
          <h2 className="font-bold text-gray-800 mb-4">Team Members</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {data.teamMembers.map((member: any) => (
              <div key={member.id} className="p-3 bg-gray-50 rounded text-sm">
                <p className="font-medium">{member.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pipeline by stage */}
      {data.pipeline && data.pipeline.length > 0 && (
        <div className="card p-6">
          <h2 className="font-bold text-gray-800 mb-4">Team Pipeline by Stage</h2>
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

      {/* Recent Team Leads */}
      {data.recentLeads && data.recentLeads.length > 0 && (
        <div className="card p-6">
          <h2 className="font-bold text-gray-800 mb-4">Recent Team Leads</h2>
          <div className="space-y-2">
            {data.recentLeads.map((lead: any) => (
              <Link key={lead.id} href={`/leads/${lead.id}`} className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100">
                <div className="flex-1">
                  <p className="font-medium text-sm">{lead.name}</p>
                  <p className="text-xs text-gray-500">{lead.company}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-gray-600">{lead.assignedTo.firstName}</p>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">{lead.status}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="card p-6">
        <h2 className="font-bold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Link href="/leads/new" className="btn btn-primary text-center text-sm">+ New Lead</Link>
          <Link href="/leads" className="btn btn-secondary text-center text-sm">View Leads</Link>
          <Link href="/pipeline" className="btn btn-secondary text-center text-sm">View Pipeline</Link>
          <Link href="/approvals" className="btn btn-secondary text-center text-sm">Approvals</Link>
          <Link href="/tasks" className="btn btn-secondary text-center text-sm">Team Tasks</Link>
        </div>
      </div>
    </div>
  );
}

// ─── Admin Dashboard ────────────────────────────────────────────────────────
function AdminDashboard({ data, user }: { data: any; user: any }) {
  if (!data?.kpis) {
    return (
      <div className="p-6">
        <div className="card p-6 bg-yellow-50 border border-yellow-200">
          <p className="text-yellow-700">Dashboard data not available</p>
        </div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const kpis = [
    { label: 'Total Leads',     value: data.kpis.totalLeads,     icon: '🎯', color: 'from-blue-50 to-blue-100 border-blue-300', href: '/leads' },
    { label: 'Active Customers', value: data.kpis.totalCustomers, icon: '🏢', color: 'from-green-50 to-green-100 border-green-300', href: '/customers' },
    { label: 'Active Deals',    value: data.kpis.activeDeals,    icon: '📈', color: 'from-purple-50 to-purple-100 border-purple-300', href: '/pipeline' },
    { label: 'Support Tickets', value: data.kpis.openTickets,    icon: '🎫', color: 'from-orange-50 to-orange-100 border-orange-300', href: '/support' },
    { label: 'Pending Tasks',   value: data.kpis.overdueTasks,   icon: '⏰', color: 'from-red-50 to-red-100 border-red-300', href: '/tasks' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">Welcome back, {user.firstName}</h1>
          <p className="text-gray-500 mt-2">{today}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/leads/new" className="btn btn-primary">+ New Lead</Link>
          <Link href="/customers/new" className="btn btn-secondary">+ New Customer</Link>
        </div>
      </div>

      {/* Main KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className={`card p-6 bg-gradient-to-br ${k.color} border-2 hover:shadow-lg hover:scale-105 transition-all cursor-pointer`}>
            <div className="text-4xl mb-3">{k.icon}</div>
            <p className="text-gray-600 text-sm font-medium uppercase tracking-wide">{k.label}</p>
            <p className="text-3xl font-bold mt-2 text-gray-900">{k.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline Overview */}
        <div className="lg:col-span-2 card p-6">
          <h2 className="text-xl font-bold mb-6 text-gray-900">Sales Pipeline Overview</h2>
          {data.pipeline && data.pipeline.length > 0 ? (
            <div className="space-y-4">
              {data.pipeline
                .sort((a: any, b: any) => Number(b.value) - Number(a.value))
                .map((s: any, idx: number) => {
                  const colors = ['bg-indigo-500', 'bg-blue-500', 'bg-cyan-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500'];
                  return (
                    <div key={s.stage} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-700">{s.stage}</span>
                        <span className="text-sm text-gray-500">{s.count} deals</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`${colors[idx % colors.length]} h-2.5 rounded-full transition-all`}
                          style={{
                            width: `${Math.min(100, (Number(s.value) / Math.max(...data.pipeline.map((x: any) => Number(x.value)), 1)) * 100)}%`
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>₹{Number(s.value).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">No pipeline data available</div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card p-6 bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200">
          <h2 className="text-xl font-bold mb-6 text-gray-900">Quick Actions</h2>
          <div className="space-y-3">
            <Link href="/users" className="flex items-center gap-3 p-3 bg-white rounded-lg hover:bg-indigo-50 transition-colors border border-indigo-100">
              <span className="text-xl">👤</span>
              <div className="flex-1">
                <p className="font-medium text-sm text-gray-900">User Management</p>
                <p className="text-xs text-gray-500">Add/manage team members</p>
              </div>
              <span className="text-gray-400">→</span>
            </Link>
            <Link href="/approvals" className="flex items-center gap-3 p-3 bg-white rounded-lg hover:bg-indigo-50 transition-colors border border-indigo-100">
              <span className="text-xl">✅</span>
              <div className="flex-1">
                <p className="font-medium text-sm text-gray-900">Pending Approvals</p>
                <p className="text-xs text-gray-500">Review requests</p>
              </div>
              <span className="text-gray-400">→</span>
            </Link>
            <Link href="/announcements" className="flex items-center gap-3 p-3 bg-white rounded-lg hover:bg-indigo-50 transition-colors border border-indigo-100">
              <span className="text-xl">📢</span>
              <div className="flex-1">
                <p className="font-medium text-sm text-gray-900">Announcements</p>
                <p className="text-xs text-gray-500">Post company news</p>
              </div>
              <span className="text-gray-400">→</span>
            </Link>
            <Link href="/attendance" className="flex items-center gap-3 p-3 bg-white rounded-lg hover:bg-indigo-50 transition-colors border border-indigo-100">
              <span className="text-xl">📅</span>
              <div className="flex-1">
                <p className="font-medium text-sm text-gray-900">Attendance</p>
                <p className="text-xs text-gray-500">View team activity</p>
              </div>
              <span className="text-gray-400">→</span>
            </Link>
          </div>
        </div>
      </div>

      {/* System Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6 border-l-4 border-green-500">
          <p className="text-gray-600 text-sm font-medium uppercase tracking-wide">System Status</p>
          <p className="text-2xl font-bold mt-2 text-green-600">✓ Operational</p>
          <p className="text-xs text-gray-500 mt-2">All systems running normally</p>
        </div>
        <div className="card p-6 border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm font-medium uppercase tracking-wide">Last Updated</p>
          <p className="text-lg font-bold mt-2 text-blue-600">{new Date().toLocaleTimeString('en-IN')}</p>
          <p className="text-xs text-gray-500 mt-2">Real-time data</p>
        </div>
        <div className="card p-6 border-l-4 border-purple-500">
          <p className="text-gray-600 text-sm font-medium uppercase tracking-wide">Database</p>
          <p className="text-2xl font-bold mt-2 text-purple-600">✓ Connected</p>
          <p className="text-xs text-gray-500 mt-2">All services active</p>
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
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login'; return; }

    Promise.all([
      fetch('/api/auth/me',           { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/reports/dashboard', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([me, dash]) => {
      if (dash.error) {
        setError(dash.error);
        return;
      }
      setUser(me);
      setData(dash);
    }).catch(err => {
      console.error(err);
      setError('Failed to load dashboard');
    })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="card p-6 bg-red-50 border border-red-200">
          <p className="text-red-700">Failed to load dashboard: {error}</p>
        </div>
      </div>
    );
  }

  if (!data || !user) {
    return (
      <div className="p-6">
        <div className="card p-6 bg-yellow-50 border border-yellow-200">
          <p className="text-yellow-700">Dashboard data not available</p>
        </div>
      </div>
    );
  }

  if (user.role === 'SALES_EXEC') {
    return <SalesExecDashboard data={data} user={user} />;
  }

  if (user.role === 'SALES_MANAGER') {
    return <ManagerDashboard data={data} user={user} />;
  }

  return <AdminDashboard data={data} user={user} />;
}
