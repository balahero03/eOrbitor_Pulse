'use client';

import Link from 'next/link';

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700 border-red-200',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
  MEDIUM: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  LOW: 'bg-gray-100 text-gray-600 border-gray-200',
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-500',
};

function StatCard({ label, value, color, alert, href }: {
  label: string; value: string | number; color: string; alert?: boolean; href?: string;
}) {
  const inner = (
    <div className={`bg-white rounded-xl border p-5 shadow-sm hover:shadow-md transition-shadow ${alert && Number(value) > 0 ? 'border-red-200' : ''} ${href ? 'cursor-pointer' : ''}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function SupportDashboard({ data }: { data: any }) {
  const { stats, myTickets } = data;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Dashboard</h1>
          <p className="text-sm text-gray-500">Your assigned tickets and queue</p>
        </div>
        <div className="flex gap-2">
          <Link href="/support/new" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            + New Ticket
          </Link>
          <Link href="/support" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
            All Tickets
          </Link>
        </div>
      </div>

      {/* Ticket KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="All Open Tickets" value={stats.openTickets} color="text-blue-600" href="/support" />
        <StatCard label="My Assigned" value={stats.myAssignedTickets} color="text-purple-600" href="/support" />
        <StatCard label="Resolved Today" value={stats.resolvedToday} color="text-green-600" />
        <StatCard label="Urgent (Mine)" value={stats.urgentTickets} color={stats.urgentTickets > 0 ? 'text-red-600' : 'text-gray-400'} alert href="/support" />
      </div>

      {/* My Ticket Queue */}
      <div className="bg-white rounded-xl border p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800">My Open Tickets</h2>
          <Link href="/support" className="text-xs text-blue-600 hover:underline">View all</Link>
        </div>

        {(!myTickets || myTickets.length === 0) ? (
          <div className="text-center py-10">
            <p className="text-4xl mb-2">✅</p>
            <p className="text-sm text-gray-500 font-medium">No open tickets assigned to you</p>
            <p className="text-xs text-gray-400 mt-1">Check the main queue for new tickets</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myTickets.map((t: any) => (
              <Link href={`/support/${t.id}`} key={t.id}
                className="flex items-start justify-between p-4 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${PRIORITY_COLORS[t.priority] || 'bg-gray-100 text-gray-600'}`}>
                      {t.priority}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-600'}`}>
                      {t.status}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-800 truncate">{t.title}</p>
                  {t.customer && (
                    <p className="text-xs text-gray-500 mt-0.5">{t.customer}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0 ml-4 mt-1">
                  {new Date(t.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { href: '/support', label: 'All Tickets', icon: '🎫' },
            { href: '/customers', label: 'Customer Lookup', icon: '🏢' },
            { href: '/tasks', label: 'My Tasks', icon: '✓' },
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
