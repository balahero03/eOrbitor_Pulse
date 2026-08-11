'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { LockIcon } from '@/components/icons';
import { requestHighlight } from '@/lib/notificationHighlight';
import { ToastProvider } from '@/components/Toast';
import { ConfirmProvider, useConfirm } from '@/components/ConfirmDialog';
import { BrandedLoader } from '@/components/BrandedLoader';
import {
  HomeIcon,
  FunnelIcon,
  ArchiveBoxIcon,
  BuildingOfficeIcon,
  PhoneIcon,
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
  UserCircleIcon
} from '@heroicons/react/24/outline';

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
          <p className="text-sm text-gray-400">Loading…</p>
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Initialise sidebar state from window width after mount (avoids SSR mismatch)
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

    if (type === 'APPROVAL_REQUESTED') {
      if (entityType === 'QUOTATION' && entityId) {
        const { destination, highlight } = await resolveQuotationDestination(entityId);
        return { destination, highlight };
      }
      // Lead/Order/Customer delete/reopen requests are reviewed on the
      // approvals list — ring the matching request card (keyed by its
      // underlying entity id, which is what the notification carries).
      if (entityId && ['LEAD', 'ORDER', 'CUSTOMER'].includes(entityType || '')) {
        return { destination: '/approvals', highlight: { scope: 'approval', id: entityId } };
      }
      // After-hours access & activity unlock requests are reviewed under Access category
      if (['AFTER_HOURS_ACCESS', 'ACTIVITY_UNLOCK'].includes(entityType || '') && entityId) {
        return { destination: '/approvals', highlight: { scope: 'access', id: entityId } };
      }
      return { destination: '/approvals', highlight: null };
    }

    if (type === 'APPROVAL_APPROVED' || type === 'APPROVAL_REJECTED') {
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
          targetDate = new Date(n.createdAt).toISOString().slice(0, 10);
        }
        const destination = targetDate ? `/daily-activity?date=${targetDate}` : '/daily-activity';
        return { destination, highlight: null };
      }
      // The outcome is about the requester's entity — go there if it still
      // exists (a reopen, or a rejected delete), else its list (an approved
      // delete). No-entity outcomes (after-hours) have no page → dashboard.
      if (entityId && ['LEAD', 'ORDER', 'CUSTOMER'].includes(entityType || '')) {
        return resolveEntityDestination(entityType as string, entityId);
      }
      return { destination: '/dashboard', highlight: null };
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

    if (type === 'ORDER_CONFIRMED' || type === 'PAYMENT_RECEIVED') {
      return entityId ? resolveEntityDestination('ORDER', entityId) : { destination: '/orders', highlight: null };
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
                    className={`relative flex items-center gap-3 mx-2 px-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
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
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden animate-fade-in"
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
        <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between flex-shrink-0">
          <button
            onClick={handleToggle}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
            aria-label="Toggle sidebar"
          >
            <Bars3Icon className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3 min-w-0">
            {/* Notification bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(o => !o)}
                className="relative p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                aria-label="Notifications"
              >
                <BellIcon className="w-6 h-6" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  {/* Scrim (mobile only). Without it the panel reads as part of
                      the page rather than a floating overlay, and there is no
                      large target to dismiss it by tapping away. */}
                  <div
                    className="fixed inset-0 bg-black/30 z-[90] sm:hidden animate-fade-in"
                    onClick={() => setNotifOpen(false)}
                    aria-hidden="true"
                  />
                  {/* The old max-height reserved only 5rem, but the sticky header
                      (3.5rem) and the mobile bottom nav (3.5rem + safe area)
                      together need ~9rem — so the panel ran underneath the nav and
                      swallowed the screen. Reserve 10rem and it floats clear of both. */}
                  <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-11 sm:w-96 bg-white border border-gray-200 rounded-2xl shadow-2xl z-[100] overflow-hidden flex flex-col max-h-[calc(100dvh-10rem)] sm:max-h-[28rem] animate-scale-in origin-top-right">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-2.5 sm:py-3 border-b border-gray-100 bg-gray-50 flex-shrink-0">
                    <div>
                      <span className="text-sm font-bold text-gray-900">Notifications</span>
                      {notifications.length > 0 && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {unreadCount} unread · {notifications.length} total
                        </p>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 hover:bg-blue-50 rounded transition-colors"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {/* Notifications list */}
                  <div className="flex-1 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="text-center py-12 px-4">
                        <p className="text-sm text-gray-400">No notifications yet</p>
                        <p className="text-xs text-gray-300 mt-1">Activity updates will appear here</p>
                      </div>
                    ) : (
                      <div>
                        {notifications.map((n, idx) => {
                          const removing = removingIds.has(n.id);
                          const isLast = idx === notifications.length - 1;
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
                                  className={`w-full text-left px-3.5 py-2.5 sm:px-4 sm:py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer group ${
                                    !n.isRead ? 'bg-blue-50 hover:bg-blue-100' : ''
                                  } ${!isLast ? 'border-b border-gray-100' : ''}`}
                                >
                                  <div className="flex items-start gap-2.5">
                                    {/* Read indicator dot */}
                                    <span
                                      className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full flex-shrink-0 mt-1.5"
                                      style={{ background: n.isRead ? '#e5e7eb' : '#3b82f6' }}
                                    />

                                    {/* Notification content — a notification is a
                                        glance, not an article: the body sat at the
                                        same size as the title, making every row
                                        ~100px tall on a phone. */}
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[13px] sm:text-sm font-semibold text-gray-900 truncate">{n.title}</p>
                                      <p className="text-xs sm:text-[13px] text-gray-600 mt-0.5 line-clamp-2 break-words">{n.message}</p>
                                      <p className="text-[11px] text-gray-400 mt-1">
                                        {new Date(n.createdAt).toLocaleString('en-IN', {
                                          day: 'numeric',
                                          month: 'short',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                          hour12: false,
                                        })}
                                      </p>
                                    </div>

                                    {/* Delete. Revealing this on hover alone meant it
                                        was unreachable on a touch device, so it stays
                                        visible on mobile and keeps the hover reveal
                                        on pointer devices. */}
                                    <button
                                      onClick={(e) => deleteNotification(n.id, e)}
                                      className="p-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 hover:bg-red-50 rounded transition-all flex-shrink-0 text-gray-400 hover:text-red-500"
                                      title="Delete notification"
                                      aria-label="Delete notification"
                                    >
                                      <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={1.5}
                                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3H4v2h16V7h-3z"
                                        />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Footer with action buttons */}
                  {notifications.length > 0 && (
                    <div className="px-4 py-2.5 sm:py-3 border-t border-gray-100 bg-gray-50 flex gap-2 flex-shrink-0">
                      {notifications.some(n => n.isRead) && (
                        <button
                          onClick={clearReadNotifications}
                          className="text-xs font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 hover:bg-gray-200 rounded transition-colors flex-1"
                        >
                          Clear read
                        </button>
                      )}
                      <button
                        onClick={clearAllNotifications}
                        className="text-xs font-medium text-red-600 hover:text-red-700 px-3 py-1.5 hover:bg-red-50 rounded transition-colors flex-1"
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

        <main className="flex-1 overflow-y-auto overflow-x-hidden relative pb-20 md:pb-0 max-w-full">
          {children}
        </main>

        {/* Mobile Bottom Navigation Bar (< 768px) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/80 px-2 py-1.5 flex items-center justify-around shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom,0.375rem)]">
          {[
            { label: 'Home', href: '/dashboard', icon: HomeIcon },
            { label: 'Leads', href: '/leads', icon: FunnelIcon },
            { label: 'Quotes', href: '/quotations', icon: PencilSquareIcon },
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
