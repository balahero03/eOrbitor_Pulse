'use client';

import { useState, useEffect, useRef } from 'react';
import { istDateString } from '@/lib/istDate';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { LockIcon } from '@/components/icons';
import { requestHighlight } from '@/lib/notificationHighlight';
import { ToastProvider } from '@/components/Toast';
import { ConfirmProvider, useConfirm } from '@/components/ConfirmDialog';
import { BrandedLoader, InlineLoader } from '@/components/BrandedLoader';
import { installSessionExpiryInterceptor } from '@/lib/authFetch';
import { useMountTransition } from '@/lib/hooks/useMountTransition';
import {
  HomeIcon,
  FunnelIcon,
  ArchiveBoxIcon,
  BuildingOfficeIcon,
  PhoneIcon,
  DocumentTextIcon,
  ShoppingBagIcon,
  CheckCircleIcon,
  PencilSquareIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  InboxStackIcon,
  ShieldCheckIcon,
  MegaphoneIcon,
  UsersIcon,
  BellIcon,
  ArrowLeftOnRectangleIcon,
  Bars3Icon,
  UserCircleIcon,
  CheckIcon,
  TrashIcon,
  ClockIcon,
  EyeIcon,
  SparklesIcon,
  XMarkIcon,
  BellSlashIcon,
  ArrowPathIcon,
  UserPlusIcon,
  DocumentCheckIcon,
} from '@heroicons/react/24/outline';
import { CheckBadgeIcon } from '@heroicons/react/24/solid';

interface MenuItem {
  label: string;
  href: string;
  icon: any;
  roles?: string[];
}

interface NavGroup {
  group: string;
  roles?: string[];
  items: MenuItem[];
}

interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}

const NAV_GROUPS: NavGroup[] = [
  {
    group: 'Main',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    ],
  },
  {
    group: 'Sales',
    roles: ['SUPER_ADMIN', 'ADMIN', 'BACKEND_TEAM', 'ON_FIELD_TEAM'],
    items: [
      { label: 'Leads', href: '/leads', icon: FunnelIcon },
      { label: 'Closed Leads', href: '/closed-leads', icon: ArchiveBoxIcon },
      { label: 'Customers', href: '/customers', icon: BuildingOfficeIcon },
      { label: 'Follow-ups', href: '/followups', icon: PhoneIcon },
      { label: 'Quotations', href: '/quotations', icon: DocumentTextIcon },
      { label: 'Orders', href: '/orders', icon: ShoppingBagIcon },
    ],
  },
  {
    group: 'Tasks & Activity',
    items: [
      { label: 'Tasks', href: '/tasks', icon: CheckCircleIcon, roles: ['SUPER_ADMIN', 'ADMIN', 'BACKEND_TEAM', 'ON_FIELD_TEAM'] },
      { label: 'My Activity', href: '/daily-activity', icon: PencilSquareIcon },
      { label: 'Attendance', href: '/attendance', icon: CalendarDaysIcon, roles: ['SUPER_ADMIN', 'ADMIN', 'BACKEND_TEAM'] },
    ],
  },
  {
    group: 'Analytics',
    roles: ['SUPER_ADMIN', 'ADMIN'],
    items: [
      { label: 'Reports', href: '/reports', icon: ChartBarIcon, roles: ['SUPER_ADMIN', 'ADMIN'] },
    ],
  },
  {
    group: 'Catalog',
    roles: ['SUPER_ADMIN', 'ADMIN', 'BACKEND_TEAM', 'ON_FIELD_TEAM'],
    items: [
      { label: 'Products', href: '/products', icon: InboxStackIcon },
    ],
  },
  {
    group: 'Management',
    roles: ['SUPER_ADMIN', 'ADMIN', 'BACKEND_TEAM'],
    items: [
      { label: 'Approvals', href: '/approvals', icon: ShieldCheckIcon, roles: ['SUPER_ADMIN', 'ADMIN', 'BACKEND_TEAM'] },
      { label: 'Announcements', href: '/announcements', icon: MegaphoneIcon, roles: ['SUPER_ADMIN', 'ADMIN'] },
    ],
  },
  {
    group: 'Admin',
    roles: ['SUPER_ADMIN', 'ADMIN'],
    items: [
      { label: 'Users', href: '/users', icon: UsersIcon, roles: ['SUPER_ADMIN', 'ADMIN'] },
    ],
  },
];

// Routes that are real destinations but deliberately absent from the sidebar.
const OFF_NAV_TITLES: Record<string, string> = {
  '/profile': 'Profile',
};

/**
 * Which section of the app a path belongs to.
 *
 * Uses the same match the sidebar uses to decide which item is active, so the
 * title in the top bar and the highlighted nav row can never disagree. A detail
 * route resolves to its section — on `/orders/abc123` the bar reads "Orders",
 * which is the question being asked ("where am I?"), not the record's name,
 * which the page itself already shows.
 */
function sectionTitleFor(pathname: string): string {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))) {
        return item.label;
      }
    }
  }
  return OFF_NAV_TITLES[pathname] ?? '';
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  SUPER_ADMIN:   { label: 'Super Admin',  color: 'bg-purple-100 text-purple-700' },
  ADMIN:         { label: 'Admin',        color: 'bg-red-100 text-red-700' },
  BACKEND_TEAM:  { label: 'Backend Team', color: 'bg-blue-100 text-blue-700' },
  ON_FIELD_TEAM: { label: 'On Field Team',color: 'bg-green-100 text-green-700' },
};

function isItemVisible(item: MenuItem, role: string): boolean {
  return !item.roles || item.roles.includes(role);
}

function isGroupVisible(group: NavGroup, role: string): boolean {
  if (group.roles && !group.roles.includes(role)) return false;
  return group.items.some((item) => isItemVisible(item, role));
}

function fmt24(hm: string) {
  const [h, m] = hm.split(':').map(Number);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffSec = Math.max(0, Math.floor((now - date) / 1000));

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

interface NotifMeta {
  icon: any;
  iconBg: string;
  iconColor: string;
  category: string;
  badgeBg: string;
}

function getNotificationMeta(n: AppNotification): NotifMeta {
  const type = n.type || '';
  const title = n.title || '';

  if (title.toLowerCase().includes('reopen') || title.toLowerCase().includes('re-open')) {
    return {
      icon: ArrowPathIcon,
      iconBg: 'bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20 shadow-xs',
      iconColor: 'text-amber-600',
      category: 'Lead Reopen',
      badgeBg: 'bg-amber-50 text-amber-700 border border-amber-200/60 font-semibold',
    };
  }

  if (title.toLowerCase().includes('transfer')) {
    return {
      icon: UserPlusIcon,
      iconBg: 'bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/20 shadow-xs',
      iconColor: 'text-blue-600',
      category: 'Lead Transfer',
      badgeBg: 'bg-blue-50 text-blue-700 border border-blue-200/60 font-semibold',
    };
  }

  if (type.startsWith('APPROVAL')) {
    if (type === 'APPROVAL_APPROVED' || title.toLowerCase().includes('approved')) {
      return {
        icon: DocumentCheckIcon,
        iconBg: 'bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 shadow-xs',
        iconColor: 'text-emerald-600',
        category: 'Approved',
        badgeBg: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-semibold',
      };
    }
    if (type === 'APPROVAL_REJECTED' || title.toLowerCase().includes('rejected')) {
      return {
        icon: ShieldCheckIcon,
        iconBg: 'bg-rose-500/10 text-rose-600 ring-1 ring-rose-500/20 shadow-xs',
        iconColor: 'text-rose-600',
        category: 'Rejected',
        badgeBg: 'bg-rose-50 text-rose-700 border border-rose-200/60 font-semibold',
      };
    }
    return {
      icon: ShieldCheckIcon,
      iconBg: 'bg-indigo-500/10 text-indigo-600 ring-1 ring-indigo-500/20 shadow-xs',
      iconColor: 'text-indigo-600',
      category: 'Approval',
      badgeBg: 'bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-semibold',
    };
  }

  if (type.startsWith('TASK')) {
    return {
      icon: CheckCircleIcon,
      iconBg: 'bg-indigo-500/10 text-indigo-600 ring-1 ring-indigo-500/20 shadow-xs',
      iconColor: 'text-indigo-600',
      category: 'Task',
      badgeBg: 'bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-semibold',
    };
  }

  if (type.startsWith('ORDER') || type.startsWith('PAYMENT')) {
    return {
      icon: ShoppingBagIcon,
      iconBg: 'bg-teal-500/10 text-teal-600 ring-1 ring-teal-500/20 shadow-xs',
      iconColor: 'text-teal-600',
      category: type.includes('PAYMENT') ? 'Payment' : 'Order',
      badgeBg: 'bg-teal-50 text-teal-700 border border-teal-200/60 font-semibold',
    };
  }

  if (type.startsWith('LEAD') || type === 'DEAL_UPDATED') {
    return {
      icon: FunnelIcon,
      iconBg: 'bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/20 shadow-xs',
      iconColor: 'text-blue-600',
      category: 'Lead',
      badgeBg: 'bg-blue-50 text-blue-700 border border-blue-200/60 font-semibold',
    };
  }

  if (type.startsWith('QUOTATION')) {
    return {
      icon: DocumentTextIcon,
      iconBg: 'bg-purple-500/10 text-purple-600 ring-1 ring-purple-500/20 shadow-xs',
      iconColor: 'text-purple-600',
      category: 'Quotation',
      badgeBg: 'bg-purple-50 text-purple-700 border border-purple-200/60 font-semibold',
    };
  }

  if (type === 'FOLLOW_UP_REMINDER') {
    return {
      icon: PhoneIcon,
      iconBg: 'bg-cyan-500/10 text-cyan-600 ring-1 ring-cyan-500/20 shadow-xs',
      iconColor: 'text-cyan-600',
      category: 'Follow-up',
      badgeBg: 'bg-cyan-50 text-cyan-700 border border-cyan-200/60 font-semibold',
    };
  }

  if (title.includes('Daily Activity') || title.includes('After-Hours Access')) {
    return {
      icon: CalendarDaysIcon,
      iconBg: 'bg-orange-500/10 text-orange-600 ring-1 ring-orange-500/20 shadow-xs',
      iconColor: 'text-orange-600',
      category: 'Access',
      badgeBg: 'bg-orange-50 text-orange-700 border border-orange-200/60 font-semibold',
    };
  }

  return {
    icon: MegaphoneIcon,
    iconBg: 'bg-slate-500/10 text-slate-700 ring-1 ring-slate-400/20 shadow-xs',
    iconColor: 'text-slate-700',
    category: 'System',
    badgeBg: 'bg-slate-100 text-slate-700 border border-slate-200/60 font-semibold',
  };
}

interface AccessRequest {
  id: string;
  date: string;
  status: string;
  rejectionReason: string | null;
}

// Shown when a user has no verified recovery email. Before the enforcement
// date it carries a Skip button and a countdown; on or after it, the Skip is
// gone and nothing but the profile page is reachable.
function RecoveryEmailRequiredScreen({
  hardBlocked, daysRemaining, hasUnverifiedAddress, onSkip, onLogout,
}: {
  hardBlocked: boolean;
  daysRemaining: number | null;
  hasUnverifiedAddress: boolean;
  onSkip?: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-200/60 p-6 sm:p-8 animate-slide-up">
        <div className="flex justify-center mb-5">
          <Image src="/e-mark.png" alt="eOrbitor" width={52} height={52} priority />
        </div>

        <span className={`mx-auto mb-4 flex w-12 h-12 rounded-xl items-center justify-center ${
          hardBlocked ? 'bg-red-50' : 'bg-amber-50'
        }`}>
          <ShieldCheckIcon className={`w-6 h-6 ${hardBlocked ? 'text-red-600' : 'text-amber-600'}`} />
        </span>

        <h1 className="text-xl font-bold text-center text-gray-900 tracking-tight">
          {hardBlocked ? 'Recovery email required' : 'Add a recovery email'}
        </h1>

        <p className="text-sm text-gray-500 text-center mt-2 leading-relaxed">
          {hardBlocked
            ? 'Your account needs a verified recovery email before you can continue using eOrbitor Pulse.'
            : hasUnverifiedAddress
              ? 'You have added an address but not confirmed it yet. Verify it so you can reset your own password if you are ever locked out.'
              : 'Your login email is not a mailbox we can reach. Add one you can open, so you can reset your own password if you are ever locked out.'}
        </p>

        {!hardBlocked && typeof daysRemaining === 'number' && (
          <p className="text-xs text-center mt-3 font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg py-2 px-3">
            {daysRemaining === 0
              ? 'This becomes required today.'
              : `Required in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`}
          </p>
        )}

        <div className="mt-6 space-y-2">
          <Link href="/profile"
            className="block w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold text-center shadow-sm hover:bg-blue-700 transition-colors">
            {hasUnverifiedAddress ? 'Verify my email' : 'Add recovery email'}
          </Link>
          {onSkip && (
            <button onClick={onSkip}
              className="w-full py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-colors">
              Skip for now
            </button>
          )}
          <button onClick={onLogout}
            className="w-full py-2 text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors">
            Log out
          </button>
        </div>

        {hardBlocked && (
          <p className="text-[11px] text-gray-400 text-center mt-5 leading-relaxed">
            No mailbox you can reach? Ask an administrator — they can set your password directly.
          </p>
        )}
      </div>
    </div>
  );
}

function AccessRestrictedScreen({
  blocked,
  onLogout,
}: {
  blocked: { date: string; windowStart: string; windowEnd: string };
  onLogout: () => void;
}) {
  const [myRequest, setMyRequest] = useState<AccessRequest | null | undefined>(undefined); // undefined = loading
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    const token = localStorage.getItem('token');
    fetch('/api/access-requests', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        const requests: AccessRequest[] = d.requests || [];
        setMyRequest(requests.find(r => r.date === blocked.date) || null);
      })
      .catch(() => setMyRequest(null));
  };

  useEffect(() => { load(); }, [blocked.date]);

  const submitRequest = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!res.ok) { const e = await res.json(); setError(e.message || 'Failed to submit request'); return; }
      load();
    } catch { setError('Failed to submit request'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50 p-4">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm max-w-md w-full p-6 text-center space-y-4">
        <LockIcon className="w-12 h-12 mx-auto" />
        <div>
          <h1 className="text-lg font-bold text-gray-900">Access Restricted</h1>
          <p className="text-sm text-gray-500 mt-1">
            CRM access is restricted between {fmt24(blocked.windowStart)} and {fmt24(blocked.windowEnd)}.
            Contact your admin, or request access below.
          </p>
        </div>

        {myRequest === undefined ? (
          <InlineLoader size="sm" />
        ) : myRequest?.status === 'PENDING' ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
            Your request is pending admin review. This screen will update automatically once it's approved.
          </div>
        ) : (
          <div className="space-y-2 text-left">
            {myRequest?.status === 'REJECTED' && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                Your last request was rejected{myRequest.rejectionReason ? `: ${myRequest.rejectionReason}` : '.'} You can submit a new one below.
              </div>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Why do you need access right now?"
              className="w-full border rounded-lg px-3 py-2 text-sm h-20 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <button onClick={submitRequest} disabled={submitting || !reason.trim()}
              className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'Submitting…' : 'Request Access'}
            </button>
          </div>
        )}

        <button onClick={onLogout} className="text-sm text-gray-500 hover:text-gray-700 underline">
          Log out
        </button>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <DashboardLayoutInner>{children}</DashboardLayoutInner>
      </ConfirmProvider>
    </ToastProvider>
  );
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const confirm = useConfirm();

  // ── Collapsing page title ──────────────────────────────────────────────────
  //
  // The top bar never scrolls, but it carried nothing that said where you were:
  // once a list scrolled past its own heading card, the only thing on screen
  // naming the page was gone, and on a phone — where the sidebar is closed —
  // there was no way to tell an Orders list from a Quotations one without
  // scrolling back up.
  //
  // Handled the way iOS large titles and WhatsApp do it: the section name rises
  // into the persistent bar exactly as the page's own heading leaves. Showing it
  // permanently would have been simpler, but it would then sit directly above
  // an identical heading at rest, which reads as a mistake.
  const mainRef = useRef<HTMLElement>(null);
  const [titlePinned, setTitlePinned] = useState(false);
  const sectionTitle = sectionTitleFor(pathname);

  const handleMainScroll = () => {
    const el = mainRef.current;
    if (!el) return;
    setTitlePinned((prev) => {
      // Two thresholds, not one. With a single value, a scroll coming to rest
      // right on it flickers the title in and out on every stray pixel.
      const next = el.scrollTop > (prev ? 24 : 56);
      return next === prev ? prev : next;
    });
  };

  // `<main>` is the scroll container, not the window, so Next's own
  // scroll-to-top on navigation does not reach it — without this, moving from a
  // scrolled Orders list to Leads landed you halfway down the new page.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    setTitlePinned(false);
  }, [pathname]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  // The <aside> drawer itself stays mounted and slides via `translate-x` with
  // a CSS transition, so closing it already looks fine. Only this backdrop
  // was a mount/unmount div with no exit — it vanished a beat before the
  // drawer finished sliding out, which read as the backdrop "snapping off"
  // while the panel was still moving.
  const { mounted: sidebarBackdropMounted, leaving: sidebarBackdropLeaving } = useMountTransition(sidebarOpen);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Initialise sidebar state from window width after mount (avoids SSR mismatch)
  // A 401 from any API call means the JWT has expired. Without this the page
  // silently stops loading data with no explanation; installed on the shell so
  // every page inherits it rather than each one re-checking.
  useEffect(() => installSessionExpiryInterceptor(), []);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    setSidebarOpen(window.innerWidth >= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [user, setUser] = useState<any>(null);
  // Session-scoped only, deliberately not persisted: the reminder should
  // return on the next sign-in rather than being dismissed once and forgotten
  // until the deadline arrives.
  const [recoveryReminderSkipped, setRecoveryReminderSkipped] = useState(false);
  const [accessBlocked, setAccessBlocked] = useState<{ date: string; windowStart: string; windowEnd: string } | null>(null);
  const [accessChecked, setAccessChecked] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifTab, setNotifTab] = useState<'ALL' | 'UNREAD'>('ALL');
  // The bell dropdown animated open but vanished instantly on close — same
  // "jump cut" the order modals had before components/Modal.tsx existed.
  // This is the one popover every user opens every session, so it is worth
  // fixing directly rather than waiting for a full rebuild onto that shell.
  const { mounted: notifMounted, leaving: notifLeaving } = useMountTransition(notifOpen);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  // Ids currently mid-delete-animation — kept separate from `notifications`
  // so the row can play its collapse/fade before actually leaving the list.
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const fetchNotifications = (token: string) => {
    fetch('/api/notifications?limit=20', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.notifications) setNotifications(data.notifications); })
      .catch(() => {});
  };

  // Total pending approvals for the sidebar badge: record requests for every
  // reviewer, plus after-hours access requests only for admins (managers can't
  // act on those, and the access list is admin-scoped anyway).
  const fetchPendingApprovals = (token: string, includeAccess: boolean) => {
    Promise.all([
      fetch('/api/approval-requests?status=PENDING&limit=1', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null),
      includeAccess
        ? fetch('/api/access-requests?status=PENDING', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null)
        : Promise.resolve(null),
    ])
      .then(([rec, acc]) => setPendingApprovals((rec?.pagination?.total ?? 0) + (acc?.requests?.length ?? 0)))
      .catch(() => {});
  };

  const markRead = async (id: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    await fetch(`/api/notifications/${id}/read`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  // Quotations are managed inline on their lead's page, not as a standalone
  // flow — so a quotation notification should land there, scrolled to and
  // highlighting the specific quote, rather than the bare /quotations/{id}
  // page. Falls back to that bare page for the rare customer-only quote that
  // isn't tied to a lead (no in-page highlight target there).
  const resolveQuotationDestination = async (quotationId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/quotations/${quotationId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const q = await res.json();
        if (q.leadId) {
          return { destination: `/leads/${q.leadId}`, destLabel: 'Quotation details', highlight: { scope: 'quotation', id: quotationId } };
        }
      }
    } catch { /* fall through to the standalone page */ }
    return { destination: `/quotations/${quotationId}`, destLabel: 'Quotation details', highlight: null as { scope: string; id: string } | null };
  };

  // Navigate to a lead/order detail page — but only after confirming the
  // entity still exists. An approved deletion (or a later cleanup) leaves the
  // notification pointing at something gone; without this check the click
  // lands on a raw "Lead not found" / "Order not found" page. When it's gone
  // we fall back to the entity's list, with no in-page target. Customers have
  // no standalone detail API to verify against, so they always go to the list.
  const resolveEntityDestination = async (
    entityType: string,
    entityId: string,
  ): Promise<{ destination: string; highlight: { scope: string; id: string } | null }> => {
    if (entityType === 'CUSTOMER') {
      return { destination: '/customers', highlight: null };
    }
    const cfg =
      entityType === 'ORDER'
        ? { api: 'orders', scope: 'order', list: '/orders' }
        : { api: 'leads', scope: 'lead', list: '/leads' };
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/${cfg.api}/${entityId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        return { destination: `/${cfg.api}/${entityId}`, highlight: { scope: cfg.scope, id: entityId } };
      }
    } catch { /* fall through to the list */ }
    return { destination: cfg.list, highlight: null };
  };

  // Map a notification to where it lands and, when it points at one specific
  // item, which item to scroll to and ring on arrival. `highlight` is null
  // when there's no single target to point at (a bare list, a gone entity).
  const resolveNotification = async (
    n: AppNotification,
  ): Promise<{ destination: string; highlight: { scope: string; id: string } | null }> => {
    const type = n.type;
    const entityType = n.relatedEntityType;
    const entityId = n.relatedEntityId;

    if (type === 'APPROVAL_REQUESTED' || type === 'APPROVAL_APPROVED' || type === 'APPROVAL_REJECTED') {
      if (entityType === 'QUOTATION' && entityId) {
        const { destination, highlight } = await resolveQuotationDestination(entityId);
        return { destination, highlight };
      }

      // Daily activity unlock & after-hours access notifications redirect user straight to daily-activity page with target date
      if (
        ['ACTIVITY_UNLOCK', 'AFTER_HOURS_ACCESS'].includes(entityType || '') ||
        n.title?.includes('Daily Activity') ||
        n.title?.includes('After-Hours Access')
      ) {
        let targetDate: string | null = null;
        const dateMatch = n.message?.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
        if (dateMatch) {
          const [, y, m, d] = dateMatch;
          targetDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        } else if (n.createdAt) {
          targetDate = istDateString(new Date(n.createdAt));
        }
        const destination = targetDate ? `/daily-activity?date=${targetDate}` : '/daily-activity';
        return { destination, highlight: null };
      }

      // Lead/Order/Customer requests
      if (entityId && ['LEAD', 'ORDER', 'CUSTOMER'].includes(entityType || '')) {
        if (entityType === 'LEAD') {
          // If it's a lead reopen/approval, check if the lead is already live/reopened
          try {
            const token = localStorage.getItem('token');
            const [leadRes, appRes] = await Promise.all([
              fetch(`/api/leads/${entityId}`, { headers: { Authorization: `Bearer ${token}` } }),
              fetch(`/api/approval-requests?limit=100`, { headers: { Authorization: `Bearer ${token}` } }),
            ]);

            if (leadRes.ok) {
              const leadData = await leadRes.json();
              const appData = appRes.ok ? await appRes.json() : null;
              const matchingReq = appData?.requests?.find((r: any) => r.entityId === entityId);

              // If approved or lead exists in active status, navigate directly to the lead and highlight it!
              if (matchingReq?.status === 'APPROVED' || type === 'APPROVAL_APPROVED' || (!matchingReq && leadData?.id)) {
                return { destination: `/leads/${entityId}`, highlight: { scope: 'lead', id: entityId } };
              }
            }
          } catch { /* fall back to approvals list */ }
        }

        return { destination: '/approvals', highlight: { scope: 'approval', id: entityId } };
      }

      return { destination: '/approvals', highlight: null };
    }

    if (type === 'TASK_ASSIGNED' || type === 'TASK_DUE') {
      return { destination: '/tasks', highlight: entityId ? { scope: 'task', id: entityId } : null };
    }

    if (type === 'USER_INACTIVE') {
      // No user detail page exists — land on the users list and ring the row.
      return { destination: '/users', highlight: entityId ? { scope: 'user', id: entityId } : null };
    }

    if (type === 'LEAD_ASSIGNED' || type === 'DEAL_UPDATED') {
      return entityId ? resolveEntityDestination('LEAD', entityId) : { destination: '/leads', highlight: null };
    }

    if (type === 'FOLLOW_UP_REMINDER') {
      return { destination: '/followups', highlight: null };
    }

    if (type === 'QUOTATION_APPROVED') {
      if (entityId) {
        const { destination, highlight } = await resolveQuotationDestination(entityId);
        return { destination, highlight };
      }
      return { destination: '/quotations', highlight: null };
    }

    if (type === 'ORDER_CONFIRMED' || type === 'PAYMENT_RECEIVED' || type === 'PAYMENT_DUE') {
      // The overdue digest carries no entity id — it is about the book as a
      // whole — so it lands on the list, filtered to what it was reporting.
      if (!entityId) return { destination: '/orders?overdue=true', highlight: null };
      return resolveEntityDestination('ORDER', entityId);
    }

    return { destination: '/dashboard', highlight: null };
  };

  // Smart notification click: mark read + navigate + point at the item.
  const handleNotifClick = async (n: AppNotification) => {
    // Always mark as read first
    if (!n.isRead) await markRead(n.id);
    setNotifOpen(false);

    const { destination, highlight } = await resolveNotification(n);

    router.push(destination);
    // requestHighlight records the target (picked up by the destination page
    // as it mounts) and also dispatches an event (caught immediately if that
    // page is already on screen). The in-page ring is the only confirmation —
    // no top banner. When there's no single item to point at, the navigation
    // itself is the feedback.
    if (highlight) {
      requestHighlight(highlight.scope, highlight.id);
    }
  };

  const markAllRead = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    await fetch('/api/notifications/read-all', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  // Duration of the row's collapse/fade-out (kept in sync with the inline
  // transition durations on the row wrapper below).
  const DELETE_ANIM_MS = 260;
  // Gap between each row starting its animation during a bulk clear, so the
  // list sweeps away in a cascade rather than vanishing all at once.
  const DELETE_STAGGER_MS = 45;

  // Plays the collapse animation for `ids`, then drops them from state once
  // it finishes. The API call runs alongside the animation, not after it, so
  // the row's exit isn't gated on network latency.
  const animateOutAndRemove = (ids: string[]) => {
    if (ids.length === 0) return;
    ids.forEach((id, i) => {
      setTimeout(() => {
        setRemovingIds(prev => new Set(prev).add(id));
      }, i * DELETE_STAGGER_MS);
    });
    const totalMs = (ids.length - 1) * DELETE_STAGGER_MS + DELETE_ANIM_MS;
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => !ids.includes(n.id)));
      setRemovingIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
    }, totalMs);
  };

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const token = localStorage.getItem('token');
    if (!token) return;
    animateOutAndRemove([id]);
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) console.error('Failed to delete notification');
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const clearAllNotifications = async () => {
    if (!(await confirm('All notifications will be permanently removed.', { title: 'Clear all notifications?', danger: true }))) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    const ids = notifications.map(n => n.id);
    animateOutAndRemove(ids);
    try {
      await Promise.all(ids.map(id =>
        fetch(`/api/notifications/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      ));
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  };

  const clearReadNotifications = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const ids = notifications.filter(n => n.isRead).map(n => n.id);
    animateOutAndRemove(ids);
    try {
      await Promise.all(ids.map(id =>
        fetch(`/api/notifications/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      ));
    } catch (error) {
      console.error('Failed to clear read notifications:', error);
    }
  };

  // Poll notifications every 30 s after user loads
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    const isReviewer = ['SUPER_ADMIN', 'ADMIN', 'BACKEND_TEAM'].includes(user.role);
    const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user.role);
    const poll = () => {
      fetchNotifications(token);
      if (isReviewer) fetchPendingApprovals(token, isAdmin);
    };
    poll();
    const interval = setInterval(poll, 30_000);
    return () => clearInterval(interval);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll access-status every 15s once the user is known. This is what makes
  // an admin's approval take effect automatically — no re-login required —
  // and what catches a live session as soon as a restricted window starts.
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    const checkAccess = () => {
      fetch('/api/access-status', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => setAccessBlocked(d.blocked ? d : null))
        .catch(() => {}) // fail open — a network hiccup shouldn't lock someone out
        .finally(() => setAccessChecked(true));
    };
    checkAccess();
    const interval = setInterval(checkAccess, 15_000);
    return () => clearInterval(interval);
  }, [user]);

  // Close notification & profile dropdowns when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close mobile overlay when navigating
  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((u) => setUser(u))
      .catch(() => { localStorage.removeItem('token'); router.push('/login'); });
  }, [router]);

  const handleLogout = async () => {
    // Shown instantly on click, same branded transition as signing in —
    // otherwise the app just sits on the current page for however long the
    // time-tracking call takes, which reads as an unresponsive click.
    setLoggingOut(true);
    const token = localStorage.getItem('token');
    if (token) {
      await fetch('/api/time-tracking', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'LOGOUT' }),
      }).catch(() => {});
    }
    localStorage.removeItem('token');
    router.push('/login');
  };

  const handleToggle = () => {
    if (window.innerWidth < 768) {
      setSidebarOpen((o) => !o);
    } else {
      setDesktopCollapsed((c) => !c);
    }
  };


  if (loggingOut) {
    return <BrandedLoader message="Signing you out…" />;
  }

  // Keep the loading screen up until the access-hours check has actually
  // come back — otherwise the real dashboard renders for one frame between
  // "user loaded" and "access-status resolved" before flipping to the
  // restricted screen, which flashes real data a blocked user shouldn't see.
  if (!user || !accessChecked) {
    return <BrandedLoader />;
  }

  if (accessBlocked) {
    return <AccessRestrictedScreen blocked={accessBlocked} onLogout={handleLogout} />;
  }

  // Recovery-email requirement. Two distinct states, and the difference is
  // the whole point of the rollout: before the configured date this is a
  // skippable reminder so nobody already using the CRM is interrupted, and
  // only afterwards does it become a wall. The server enforces the same rule
  // independently — this screen exists to explain it, not to impose it.
  const re = user.recoveryEmail;
  const needsRecovery = re && !re.verified;
  const onProfile = pathname === '/profile';
  if (needsRecovery && !onProfile && !recoveryReminderSkipped) {
    return (
      <RecoveryEmailRequiredScreen
        hardBlocked={!!re.blocked}
        daysRemaining={re.daysRemaining}
        hasUnverifiedAddress={!!re.address}
        onSkip={re.blocked ? undefined : () => setRecoveryReminderSkipped(true)}
        onLogout={handleLogout}
      />
    );
  }

  const roleInfo = ROLE_LABELS[user.role] || { label: user.role, color: 'bg-gray-100 text-gray-600' };
  // On mobile overlay drawer: always show full labels and brand info. On desktop: toggle full vs icon-only.
  const showLabels = isMobile ? true : !desktopCollapsed;

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className={`border-b border-gray-200 flex items-center min-h-[64px] ${showLabels ? 'px-4 py-3 gap-2' : 'px-2 py-3 justify-center'}`}>
        {showLabels ? (
          <>
            {/* Wide wordmark rendered at its true 4.47:1 aspect so it reads crisp and fills the brand row */}
            <Image src="/eOrbitor_logo.jpg" alt="eOrbitor" width={143} height={32} className="h-8 w-auto" priority />
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-1.5 py-0.5 rounded">Pulse</span>
          </>
        ) : (
          <Image src="/icon.png" alt="eOrbitor" width={32} height={32} className="w-8 h-8 rounded-lg object-contain" priority />
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {NAV_GROUPS.map((group) => {
          if (!isGroupVisible(group, user.role)) return null;
          const visibleItems = group.items.filter((item) => isItemVisible(item, user.role));
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.group} className="mb-1">
              {showLabels && (
                <p className="px-4 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                  {group.group}
                </p>
              )}
              {visibleItems.map((item) => {
                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={!showLabels ? item.label : undefined}
                    className={`relative flex items-center gap-3 mx-2 px-2.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ease-in-out active:scale-95 ${
                      active
                        ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/25 scale-[1.01]'
                        : 'text-gray-600 hover:bg-blue-50/70 hover:text-blue-700'
                    }`}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                    {showLabels && <span className="truncate flex-1">{item.label}</span>}
                    {item.href === '/approvals' && pendingApprovals > 0 && (
                      <span className={`flex-shrink-0 text-[10px] font-bold rounded-full min-w-[18px] text-center px-1.5 py-0.5 ${showLabels ? 'bg-amber-500 text-white' : 'bg-amber-500 text-white absolute top-1 right-1'}`}>
                        {pendingApprovals}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* User info + logout */}
      <div className="p-3 border-t border-gray-200">
        {showLabels ? (
          <div className="mb-2 px-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {user.firstName.charAt(0)}{(user.lastName || '').charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user.firstName} {user.lastName}</p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              </div>
            </div>
            <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${roleInfo.color}`}>
              {roleInfo.label}
            </span>
          </div>
        ) : null}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
        >
          <ArrowLeftOnRectangleIcon className="w-5 h-5 flex-shrink-0" />
          {showLabels && <span>Logout</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-x-hidden max-w-full">
      {/* Mobile overlay backdrop */}
      {sidebarBackdropMounted && (
        <div
          className={`fixed inset-0 z-20 bg-black/40 md:hidden ${sidebarBackdropLeaving ? 'animate-fade-out' : 'animate-fade-in'}`}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — mobile: fixed overlay drawer; desktop: static collapsed/expanded */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 bg-white border-r border-gray-200 flex flex-col overflow-hidden transition-all duration-300
        md:static md:z-auto md:flex-shrink-0
        ${sidebarOpen ? 'w-60 translate-x-0' : '-translate-x-full w-60'}
        md:translate-x-0 ${desktopCollapsed ? 'md:w-14' : 'md:w-60'}
      `}>
        {sidebarContent}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 max-w-full">
        {/* Top bar */}
        {/* `z-30` + a shadow that only appears once there is content behind it:
            at rest the bar should read as part of the page, and only lift off it
            while it is covering something. */}
        <header
          className={`bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between gap-2 flex-shrink-0 relative z-30 transition-shadow duration-200 ${
            titlePinned ? 'shadow-sm' : ''
          }`}
        >
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <button
              onClick={handleToggle}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors flex-shrink-0"
              aria-label="Toggle sidebar"
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
            {/* Always rendered, only revealed — animating opacity and transform
                rather than mounting it keeps the bar's height fixed, so the
                page underneath never shifts as the title appears. */}
            {sectionTitle && (
              <h2
                aria-hidden={!titlePinned}
                className={`text-base font-bold text-gray-900 truncate transition-all duration-200 ease-out ${
                  titlePinned
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-1.5 pointer-events-none'
                }`}
              >
                {sectionTitle}
              </h2>
            )}
          </div>
          <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
            {/* Notification Center */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(o => !o)}
                className={`relative p-2 rounded-xl text-slate-600 transition-all duration-200 focus:outline-none ${
                  notifOpen
                    ? 'bg-blue-50/80 text-blue-600 ring-2 ring-blue-500/20 shadow-sm'
                    : 'hover:bg-slate-100/80 active:scale-95'
                }`}
                aria-label="Notifications"
              >
                <BellIcon className="w-5 h-5 transition-transform duration-200" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 px-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-bold rounded-full items-center justify-center shadow-[0_2px_8px_rgba(37,99,235,0.35)] ring-2 ring-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {notifMounted && (
                <>
                  {/* Scrim (mobile overlay) */}
                  <div
                    className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[90] sm:hidden ${notifLeaving ? 'animate-fade-out' : 'animate-fade-in'}`}
                    onClick={() => setNotifOpen(false)}
                    aria-hidden="true"
                  />

                  {/* Notification Center Floating Panel */}
                  <div className={`fixed inset-x-3 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-12 sm:w-[440px] bg-white/95 backdrop-blur-2xl border border-slate-200/90 rounded-2xl shadow-[0_20px_50px_rgba(15,23,42,0.18),0_4px_16px_rgba(15,23,42,0.06)] z-[100] overflow-hidden flex flex-col max-h-[calc(100dvh-9rem)] sm:max-h-[34rem] origin-top-right transition-all ${notifLeaving ? 'animate-scale-out' : 'animate-scale-in'}`}>
                    
                    {/* Header */}
                    <div className="px-4 pt-3.5 pb-3 border-b border-slate-100 bg-white/80 backdrop-blur-md flex-shrink-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-slate-900 tracking-tight">Notifications</span>
                          {unreadCount > 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-600 border border-blue-200/60 shadow-xs">
                              {unreadCount} new
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {unreadCount > 0 && (
                            <button
                              onClick={markAllRead}
                              className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-2.5 py-1.5 hover:bg-blue-50/80 active:bg-blue-100 rounded-lg transition-all inline-flex items-center gap-1.5"
                              title="Mark all as read"
                            >
                              <CheckBadgeIcon className="w-4 h-4 text-blue-600" />
                              <span>Mark all read</span>
                            </button>
                          )}
                          <button
                            onClick={() => setNotifOpen(false)}
                            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg sm:hidden"
                            aria-label="Close"
                          >
                            <XMarkIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      {/* Filter Switcher Tabs */}
                      <div className="mt-3 flex items-center p-1 bg-slate-100/90 rounded-xl">
                        <button
                          onClick={() => setNotifTab('ALL')}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-1.5 ${
                            notifTab === 'ALL'
                              ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200/60'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          <span>All</span>
                          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                            notifTab === 'ALL' ? 'bg-slate-100 text-slate-700' : 'bg-slate-200/70 text-slate-500'
                          }`}>
                            {notifications.length}
                          </span>
                        </button>
                        <button
                          onClick={() => setNotifTab('UNREAD')}
                          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center justify-center gap-1.5 ${
                            notifTab === 'UNREAD'
                              ? 'bg-white text-blue-600 shadow-xs ring-1 ring-blue-200/60'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          <span>Unread</span>
                          {unreadCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-500 text-white">
                              {unreadCount}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Notifications list */}
                    <div className="flex-1 overflow-y-auto divide-y divide-slate-100/80">
                      {(() => {
                        const items = notifTab === 'UNREAD' ? notifications.filter(n => !n.isRead) : notifications;

                        if (items.length === 0) {
                          return (
                            <div className="text-center py-12 px-6">
                              <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-400 mb-3 shadow-inner">
                                {notifTab === 'UNREAD' ? (
                                  <SparklesIcon className="w-6 h-6 text-blue-500" />
                                ) : (
                                  <BellSlashIcon className="w-6 h-6 text-slate-400" />
                                )}
                              </div>
                              <p className="text-sm font-semibold text-slate-800">
                                {notifTab === 'UNREAD' ? "You're all caught up!" : 'No notifications yet'}
                              </p>
                              <p className="text-xs text-slate-500 mt-1 max-w-[240px] mx-auto leading-relaxed">
                                {notifTab === 'UNREAD'
                                  ? 'All incoming alerts and task updates have been reviewed.'
                                  : 'New assignments, approvals, and reminders will appear here in real-time.'}
                              </p>
                            </div>
                          );
                        }

                        return items.map((n) => {
                          const removing = removingIds.has(n.id);
                          const meta = getNotificationMeta(n);
                          const Icon = meta.icon;

                          return (
                            <div
                              key={n.id}
                              style={{
                                display: 'grid',
                                gridTemplateRows: removing ? '0fr' : '1fr',
                                opacity: removing ? 0 : 1,
                                transform: removing ? 'translateX(28px)' : 'translateX(0)',
                                transition: 'grid-template-rows 260ms ease, opacity 220ms ease, transform 260ms ease',
                              }}
                            >
                              <div className="overflow-hidden">
                                <div
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => handleNotifClick(n)}
                                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNotifClick(n); } }}
                                  className={`relative w-full text-left p-3.5 sm:p-4 hover:bg-slate-50/90 active:bg-slate-100/90 transition-all cursor-pointer group ${
                                    !n.isRead ? 'bg-blue-50/30' : ''
                                  }`}
                                >
                                  {/* Unread Indicator Bar */}
                                  {!n.isRead && (
                                    <div className="absolute left-0 top-2 bottom-2 w-1 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-r-full shadow-xs" />
                                  )}

                                  <div className="flex items-start gap-3.5">
                                    {/* Categorized Professional Icon Pod */}
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105 ${meta.iconBg}`}>
                                      <Icon className="w-5 h-5 stroke-[2]" />
                                    </div>

                                    {/* Text Body */}
                                    <div className="min-w-0 flex-1">
                                      {/* Category & Timestamp Top Row */}
                                      <div className="flex items-center justify-between gap-2 mb-1">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider ${meta.badgeBg}`}>
                                          {meta.category}
                                        </span>
                                        <span
                                          className="text-[11px] font-medium text-slate-400 whitespace-nowrap flex-shrink-0"
                                          title={new Date(n.createdAt).toLocaleString('en-IN', {
                                            dateStyle: 'medium',
                                            timeStyle: 'short',
                                          })}
                                        >
                                          {formatRelativeTime(n.createdAt)}
                                        </span>
                                      </div>

                                      {/* Full Title (No Premature Truncation) */}
                                      <h4 className={`text-[13px] sm:text-sm font-semibold leading-snug break-words transition-colors ${
                                        !n.isRead ? 'text-slate-900 font-bold group-hover:text-blue-600' : 'text-slate-700 group-hover:text-slate-900'
                                      }`}>
                                        {n.title}
                                      </h4>

                                      {/* Message description */}
                                      <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed break-words">
                                        {n.message}
                                      </p>
                                    </div>

                                    {/* Action Buttons on Hover / Mobile */}
                                    <div className="flex items-center gap-1 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0 pt-0.5">
                                      {!n.isRead && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            markRead(n.id);
                                          }}
                                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50/80 active:bg-blue-100 rounded-lg transition-all"
                                          title="Mark as read"
                                          aria-label="Mark as read"
                                        >
                                          <CheckIcon className="w-4 h-4 stroke-[2]" />
                                        </button>
                                      )}
                                      <button
                                        onClick={(e) => deleteNotification(n.id, e)}
                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50/80 active:bg-rose-100 rounded-lg transition-all"
                                        title="Delete notification"
                                        aria-label="Delete notification"
                                      >
                                        <TrashIcon className="w-4 h-4 stroke-[2]" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                      <div className="px-4 py-2.5 sm:py-3 border-t border-slate-100 bg-slate-50/80 backdrop-blur-md flex items-center justify-between gap-2 flex-shrink-0">
                        {notifications.some(n => n.isRead) && (
                          <button
                            onClick={clearReadNotifications}
                            className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 hover:bg-white active:bg-slate-100 rounded-lg border border-slate-200/70 shadow-xs transition-all flex-1 text-center"
                          >
                            Clear read
                          </button>
                        )}
                        <button
                          onClick={clearAllNotifications}
                          className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-3 py-1.5 hover:bg-rose-50 active:bg-rose-100 rounded-lg transition-all flex-1 text-center"
                        >
                          Clear all
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* User Profile Dropdown Menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(o => !o)}
                className="flex items-center gap-2 p-1 rounded-xl hover:bg-gray-100 transition-colors focus:outline-none"
                aria-label="User menu"
              >
                <span className={`hidden xs:inline-flex text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${roleInfo.color}`}>
                  <span className="hidden sm:inline">{roleInfo.label}</span>
                  <span className="sm:hidden">{roleInfo.label.charAt(0)}</span>
                </span>
                <span className="text-sm font-medium text-gray-700 hidden sm:block truncate max-w-[140px]">
                  {user.firstName} {user.lastName}
                </span>
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-sm flex-shrink-0">
                  {user.firstName.charAt(0)}{(user.lastName || '').charAt(0)}
                </div>
              </button>

              {userMenuOpen && (
                <div className="fixed inset-x-2 top-14 sm:absolute sm:inset-auto sm:right-0 sm:top-11 w-[calc(100vw-1rem)] max-w-xs sm:w-64 bg-white border border-gray-200 rounded-2xl shadow-2xl z-[100] overflow-hidden py-2 divide-y divide-gray-100 mx-auto sm:mx-0 animate-scale-in origin-top-right">
                  <div className="px-4 py-3 bg-gray-50/50">
                    <p className="text-sm font-bold text-gray-900 truncate">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{user.email}</p>
                    <div className="mt-2">
                      <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-semibold ${roleInfo.color}`}>
                        {roleInfo.label}
                      </span>
                    </div>
                  </div>

                  <div className="py-1">
                    <Link
                      href="/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors"
                    >
                      <UserCircleIcon className="w-4 h-4 text-gray-400" />
                      My Profile
                    </Link>
                    <Link
                      href="/daily-activity"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors"
                    >
                      <PencilSquareIcon className="w-4 h-4 text-gray-400" />
                      Daily Activity Log
                    </Link>
                    <Link
                      href="/attendance"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors"
                    >
                      <CheckCircleIcon className="w-4 h-4 text-gray-400" />
                      Attendance &amp; Clock-in
                    </Link>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <ArrowLeftOnRectangleIcon className="w-4 h-4 text-red-500" />
                      Log Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main
          ref={mainRef}
          onScroll={handleMainScroll}
          className="flex-1 overflow-y-auto overflow-x-hidden relative pb-20 md:pb-0 max-w-full"
        >
          {children}
        </main>

        {/* Mobile Bottom Navigation Bar (< 768px) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/80 px-2 py-1.5 flex items-center justify-around shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom,0.375rem)]">
          {[
            { label: 'Home', href: '/dashboard', icon: HomeIcon },
            { label: 'Leads', href: '/leads', icon: FunnelIcon },
            { label: 'Quotes', href: '/quotations', icon: DocumentTextIcon },
            { label: 'Orders', href: '/orders', icon: ShoppingBagIcon },
            { label: 'Tasks', href: '/tasks', icon: CheckCircleIcon },
          ].map((item) => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl text-[10px] font-medium transition-all ${
                  active
                    ? 'text-blue-600 font-bold scale-105 bg-blue-50/60'
                    : 'text-gray-500 hover:text-gray-900 active:scale-95'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-blue-600 stroke-[2.2]' : 'text-gray-500'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
