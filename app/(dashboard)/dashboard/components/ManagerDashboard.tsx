'use client';

import Link from 'next/link';
import { AnnouncementIcon, CalendarIcon, ShieldIcon, PlusGlyph } from '@/components/icons';
import {
  FunnelIcon, BriefcaseIcon, TrophyIcon, ClipboardDocumentListIcon,
  ClockIcon, BellAlertIcon, EnvelopeIcon,
} from '@heroicons/react/24/outline';

const fmt = (v: number | string) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(v) || 0);

// Same flat white-card-with-icon-chip StatCard used on the other dashboards —
// see the note in AdminDashboard.tsx.
interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tint: string;
  color: string;
  href?: string;
}

function StatCard({ label, value, icon: Icon, tint, color, href }: StatCardProps) {
  const inner = (
    <div className="h-full bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mt-1 leading-tight break-words">{value}</p>
        </div>
        <span className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${tint}`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </span>
      </div>
    </div>
  );
  return href ? <Link href={href} className="block h-full">{inner}</Link> : inner;
}

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

const PRIORITY_STYLE: Record<string, string> = {
  HIGH: 'border-red-400 bg-red-50',
  NORMAL: 'border-blue-200 bg-blue-50',
  LOW: 'border-gray-200 bg-gray-50',
};
const PRIORITY_BADGE: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-700',
  NORMAL: 'bg-blue-100 text-blue-700',
  LOW: 'bg-gray-100 text-gray-500',
};

function AnnouncementsPanel({ announcements }: { announcements: any[] }) {
  if (!announcements?.length) return null;
  // The dashboard is a summary, but this panel used to render every published
  // announcement — on a phone that filled the whole first screen and pushed the
  // KPIs below the fold. Cap it and link out to the full list, matching how the
  // other panels on this page ("All leads", "View all") behave.
  const MAX_SHOWN = 3;
  const shown = announcements.slice(0, MAX_SHOWN);
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2"><AnnouncementIcon className="w-5 h-5" /> Announcements</h2>
        <Link href="/announcements" className="text-xs text-blue-600 hover:underline flex-shrink-0">
          {announcements.length > MAX_SHOWN ? `View all (${announcements.length})` : 'View all'}
        </Link>
      </div>
      <div className="space-y-3">
        {shown.map((a: any) => (
          <div key={a.id} className={`rounded-lg border-l-4 px-4 py-3 ${PRIORITY_STYLE[a.priority] || PRIORITY_STYLE.NORMAL}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900">{a.title}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${PRIORITY_BADGE[a.priority] || PRIORITY_BADGE.NORMAL}`}>
                {a.priority}
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1 line-clamp-3 sm:line-clamp-none">{a.content}</p>
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

// Login email isn't guaranteed to be a real mailbox, so "forgot password"
// self-service only works once a verified recovery email is on file — nudge
// toward Profile until it is.
function RecoveryEmailBanner() {
  return (
    <Link
      href="/profile"
      className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm hover:bg-amber-100/70 transition-colors"
    >
      <span className="flex items-center gap-2 text-amber-800 min-w-0">
        <EnvelopeIcon className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">Add and verify a recovery email so you can reset your password if you're ever locked out.</span>
      </span>
      <span className="text-xs font-semibold text-amber-900 whitespace-nowrap flex-shrink-0">Go to Profile →</span>
    </Link>
  );
}

export default function ManagerDashboard({ data }: { data: any }) {
  const { stats, teamMembers, leaderboard, pipeline, recentLeads, announcements, needsRecoveryEmail } = data;

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {needsRecoveryEmail && <RecoveryEmailBanner />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Manager Dashboard</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{data.teamName}</p>
        </div>
        <Link href="/attendance"
          className="px-3.5 sm:px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-colors text-center inline-flex items-center justify-center gap-2 w-full sm:w-auto">
          <CalendarIcon className="w-4 h-4" />
          Attendance
        </Link>
      </div>

      <AnnouncementsPanel announcements={announcements} />

      {/* Team results */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Team Leads" value={stats.teamLeads} icon={FunnelIcon} tint="bg-blue-50" color="text-blue-600" href="/leads" />
        <StatCard label="Team Active Deals" value={stats.teamDeals} icon={BriefcaseIcon} tint="bg-purple-50" color="text-purple-600" />
        <StatCard label="Won This Month" value={stats.teamWonThisMonth} icon={TrophyIcon} tint="bg-green-50" color="text-green-600" />
      </div>

      {/* Team workload */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Open Tasks" value={stats.teamOpenTasks} icon={ClipboardDocumentListIcon} tint="bg-gray-100" color="text-gray-600" href="/tasks" />
        <StatCard label="Overdue Tasks" value={stats.teamOverdueTasks} icon={ClockIcon} tint="bg-red-50" color="text-red-600" href="/tasks" />
        <StatCard label="Overdue Follow-ups" value={stats.teamFollowUpsOverdue} icon={BellAlertIcon} tint="bg-orange-50" color="text-orange-600" href="/leads" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Team Leaderboard */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">Team Leaderboard (This Month)</h2>
          </div>
          {(!leaderboard || leaderboard.length === 0) ? (
            <p className="text-sm text-gray-400 text-center py-4">No team members yet</p>
          ) : (
            <div className="space-y-3">
              {[...leaderboard]
                .sort((a: any, b: any) => b.wonThisMonth - a.wonThisMonth)
                .map((m: any, i: number) => (
                  <div key={m.userId} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? 'bg-yellow-100 text-yellow-700' :
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800">Recent Team Leads</h2>
          <Link href="/leads" className="text-xs text-blue-600 hover:underline">View all</Link>
        </div>
        {(!recentLeads || recentLeads.length === 0) ? (
          <p className="text-sm text-gray-400 text-center py-4">No leads yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[420px]">
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { href: '/leads/new', label: 'New Lead', Icon: PlusGlyph },
            { href: '/approvals', label: 'Approvals', Icon: ShieldIcon },
            { href: '/attendance', label: 'Attendance', Icon: CalendarIcon },
          ].map((item) => (
            <Link key={item.href} href={item.href}
              className="group flex items-center gap-3 px-4 py-3.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 transition-colors">
              <span className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                <item.Icon className="w-5 h-5" />
              </span>
              <span className="text-sm font-semibold text-gray-900">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
