'use client';

import Link from 'next/link';
import { AnnouncementIcon, CalendarIcon, ReportIcon } from '@/components/icons';
import {
  FunnelIcon, BriefcaseIcon, ChartBarIcon, CurrencyRupeeIcon, ClockIcon,
  ShieldCheckIcon, UsersIcon, BuildingOfficeIcon,
  ArrowTrendingUpIcon, ArrowTrendingDownIcon,
  PlusCircleIcon, PencilSquareIcon, TrashIcon, EyeIcon, ArrowDownTrayIcon, EnvelopeIcon, TagIcon,
} from '@heroicons/react/24/outline';

const fmtNum = (v: number | string) =>
  new Intl.NumberFormat('en-IN').format(Number(v) || 0);

// Trims a decimal to at most 2 places without a trailing ".00"/".0".
const trimNum = (n: number) => n.toFixed(2).replace(/\.?0+$/, '');

// Compact ₹ notation (lakh/crore) for the big KPI tiles — a full
// `toLocaleString` currency value ("₹25,20,000") doesn't fit a fixed-width
// tile at the display font size and was getting clipped to "₹25,2…".
const fmtCompact = (v: number | string) => {
  const n = Number(v) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}₹${trimNum(abs / 1e7)}Cr`;
  if (abs >= 1e5) return `${sign}₹${trimNum(abs / 1e5)}L`;
  if (abs >= 1e3) return `${sign}₹${trimNum(abs / 1e3)}K`;
  return `${sign}₹${abs.toLocaleString('en-IN')}`;
};

// Same flat white-card-with-icon-chip language used across the other
// dashboards (and the "module tile" chips in components/icons.tsx) — no
// gradients, so this reads as one system with the rest of the app rather
// than a one-off design.
interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tint: string;
  color: string;
  sub?: string;
  trend?: { value: number; positive: boolean };
  href?: string;
}

function StatCard({ label, value, icon: Icon, tint, color, sub, trend, href }: StatCardProps) {
  const inner = (
    <div className="h-full bg-white rounded-xl border border-gray-200 p-3 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mt-1 leading-tight break-words">{value}</p>
        </div>
        <span className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${tint}`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </span>
      </div>
      {(sub || trend) && (
        <div className="flex items-center gap-1.5 mt-2">
          {trend && (
            <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
              trend.positive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {trend.positive ? <ArrowTrendingUpIcon className="w-3 h-3" /> : <ArrowTrendingDownIcon className="w-3 h-3" />}
              {Math.abs(trend.value)}%
            </span>
          )}
          {sub && <span className="text-xs text-gray-400 truncate">{sub}</span>}
        </div>
      )}
    </div>
  );
  return href ? <Link href={href} className="block h-full">{inner}</Link> : inner;
}

// ActivityAction → icon/colour, so the activity feed reads at a glance
// instead of every row showing the same generic check mark.
const ACTION_META: Record<string, { icon: React.ComponentType<{ className?: string }>; tint: string; color: string }> = {
  CREATE: { icon: PlusCircleIcon, tint: 'bg-green-50', color: 'text-green-600' },
  UPDATE: { icon: PencilSquareIcon, tint: 'bg-blue-50', color: 'text-blue-600' },
  DELETE: { icon: TrashIcon, tint: 'bg-red-50', color: 'text-red-600' },
  VIEW: { icon: EyeIcon, tint: 'bg-gray-100', color: 'text-gray-500' },
  EXPORT: { icon: ArrowDownTrayIcon, tint: 'bg-purple-50', color: 'text-purple-600' },
  SEND_EMAIL: { icon: EnvelopeIcon, tint: 'bg-sky-50', color: 'text-sky-600' },
};
const ACTION_FALLBACK = { icon: TagIcon, tint: 'bg-gray-100', color: 'text-gray-400' };

// ActivityLog.entityType → the page that record actually lives on, so a
// dashboard row can deep-link straight to it. USER/ANNOUNCEMENT/APPROVAL
// don't have a per-record detail route (list-only pages), and DEAL has no
// frontend page at all — those fall back to null (not clickable) rather
// than link to a 404.
function activityHref(entityType: string, entityId?: string): string | null {
  if (!entityId) return null;
  switch ((entityType || '').toUpperCase()) {
    case 'LEAD': return `/leads/${entityId}`;
    case 'CUSTOMER': return `/customers/${entityId}`;
    case 'ORDER': return `/orders/${entityId}`;
    case 'QUOTATION': return `/quotations/${entityId}`;
    case 'PRODUCT': return `/products/${entityId}`;
    case 'TASK': return `/tasks/${entityId}`;
    case 'FOLLOWUP':
    case 'FOLLOW_UP': return `/followups/${entityId}`;
    case 'USER': return '/users';
    case 'ANNOUNCEMENT': return '/announcements';
    case 'APPROVAL':
    case 'APPROVAL_REQUEST': return '/approvals';
    default: return null;
  }
}

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

export default function AdminDashboard({ data }: { data: any }) {
  const { kpis, recentActivity, announcements, needsRecoveryEmail } = data;
  const revenueGrowth = (kpis?.lastMonthRevenue && kpis.lastMonthRevenue > 0)
    ? Number((((kpis?.monthRevenue - kpis.lastMonthRevenue) / kpis.lastMonthRevenue) * 100).toFixed(1))
    : null;
  const revenueUp = revenueGrowth !== null && revenueGrowth >= 0;

  return (
    <div className="p-3 sm:p-6 space-y-3 sm:space-y-5">
      {needsRecoveryEmail && <RecoveryEmailBanner />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Real-time company performance metrics</p>
        </div>
        <Link href="/users" className="px-3.5 sm:px-4 py-2 bg-blue-600 text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-blue-700 transition-colors text-center shadow-sm inline-flex items-center justify-center gap-2 w-full sm:w-auto">
          <UsersIcon className="w-4 h-4" />
          Manage Users
        </Link>
      </div>

      <AnnouncementsPanel announcements={announcements} />

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total Leads" value={fmtNum(kpis?.totalLeads || 0)}
          icon={FunnelIcon} tint="bg-blue-50" color="text-blue-600" href="/leads"
        />
        <StatCard
          label="Active Deals" value={fmtNum(kpis?.activeDeals || 0)}
          icon={BriefcaseIcon} tint="bg-purple-50" color="text-purple-600"
        />
        <StatCard
          label="Pipeline Value" value={fmtCompact(kpis?.dealsPipelineValue || 0)}
          icon={ChartBarIcon} tint="bg-indigo-50" color="text-indigo-600"
        />
        <StatCard
          label="Monthly Revenue" value={fmtCompact(kpis?.monthRevenue || 0)}
          icon={CurrencyRupeeIcon}
          tint={revenueUp ? 'bg-green-50' : 'bg-red-50'}
          color={revenueUp ? 'text-green-600' : 'text-red-600'}
          trend={revenueGrowth !== null ? { value: revenueGrowth, positive: revenueUp } : undefined}
          sub={revenueGrowth !== null ? 'vs last month' : undefined}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total Customers" value={fmtNum(kpis?.totalCustomers || 0)}
          icon={BuildingOfficeIcon} tint="bg-teal-50" color="text-teal-600" href="/customers"
        />
        <StatCard
          label="Overdue Tasks" value={kpis?.overdueTasks || 0}
          icon={ClockIcon} tint="bg-orange-50" color="text-orange-600" href="/tasks"
        />
        <StatCard
          label="Pending Approvals" value={kpis?.pendingApprovals || 0}
          icon={ShieldCheckIcon} tint="bg-amber-50" color="text-amber-600" href="/approvals"
        />
        <StatCard
          label="Active Users" value={kpis?.totalUsers || 0}
          icon={UsersIcon} tint="bg-gray-100" color="text-gray-600" href="/users"
        />
      </div>

      {/* Recent Activity Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6">
        <div className="mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Recent Activity</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Latest system events and changes</p>
        </div>
        {(!recentActivity || recentActivity.length === 0) ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-1">
            {recentActivity.slice(0, 5).map((a: any) => {
              const meta = ACTION_META[a.action] || ACTION_FALLBACK;
              const href = activityHref(a.entity, a.entityId);
              const row = (
                <div className="flex items-center gap-3 p-2.5 rounded-lg">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.tint}`}>
                    <meta.icon className={`w-4 h-4 ${meta.color}`} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{a.action.replace('_', ' ')}</p>
                    <p className="text-xs text-gray-500">{a.entity}</p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                    {new Date(a.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}
                  </span>
                </div>
              );
              return href ? (
                <Link key={a.id} href={href} className="block hover:bg-gray-50 rounded-lg transition-colors">{row}</Link>
              ) : (
                <div key={a.id}>{row}</div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { href: '/announcements', label: 'Announcements', Icon: AnnouncementIcon, desc: 'Create & manage' },
            { href: '/attendance', label: 'Attendance', Icon: CalendarIcon, desc: 'View records' },
            { href: '/reports', label: 'Reports', Icon: ReportIcon, desc: 'Generate reports' },
          ].map((item) => (
            <Link key={item.href} href={item.href}
              className="group flex items-center gap-3 px-4 py-3.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 transition-colors">
              <span className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
                <item.Icon className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-500 truncate">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
