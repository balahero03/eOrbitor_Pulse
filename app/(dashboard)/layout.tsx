'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { LockIcon } from '@/components/icons';
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
  Bars3Icon
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
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [accessBlocked, setAccessBlocked] = useState<{ date: string; windowStart: string; windowEnd: string } | null>(null);
  const [accessChecked, setAccessChecked] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const fetchNotifications = (token: string) => {
    fetch('/api/notifications?limit=20', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.notifications) setNotifications(data.notifications); })
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
  // page. Falls back to that bare page for the rare customer-only quote
  // that isn't tied to a lead.
  const resolveQuotationDestination = async (quotationId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/quotations/${quotationId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const q = await res.json();
        if (q.leadId) {
          return { destination: `/leads/${q.leadId}?quotation=${quotationId}`, destLabel: 'Quotation details' };
        }
      }
    } catch { /* fall through to the standalone page */ }
    return { destination: `/quotations/${quotationId}`, destLabel: 'Quotation details' };
  };

  // Smart notification click: mark read + navigate to the correct section
  const handleNotifClick = async (n: AppNotification) => {
    // Always mark as read first
    if (!n.isRead) await markRead(n.id);
    setNotifOpen(false);

    const type = n.type;
    const entityType = n.relatedEntityType;
    const entityId = n.relatedEntityId;

    let destination = '';
    let destLabel = '';

    if (type === 'APPROVAL_REQUESTED') {
      if (entityType === 'QUOTATION' && entityId) {
        ({ destination, destLabel } = await resolveQuotationDestination(entityId));
      } else {
        destination = '/approvals';
        destLabel = 'Approvals';
      }
    } else if (type === 'APPROVAL_APPROVED' || type === 'APPROVAL_REJECTED') {
      if (entityType === 'LEAD' && entityId) {
        destination = `/leads/${entityId}`;
        destLabel = 'Lead details';
      } else if (entityType === 'ORDER' && entityId) {
        destination = `/orders/${entityId}`;
        destLabel = 'Order details';
      } else if (entityType === 'CUSTOMER' && entityId) {
        destination = `/customers/${entityId}`;
        destLabel = 'Customer details';
      } else {
        destination = '/approvals';
        destLabel = 'Approvals';
      }
    } else if (type === 'TASK_ASSIGNED' || type === 'TASK_DUE') {
      destination = '/tasks';
      destLabel = 'Tasks';
    } else if (type === 'USER_INACTIVE') {
      destination = entityId ? `/users/${entityId}` : '/users';
      destLabel = 'User profile';
    } else if (type === 'LEAD_ASSIGNED') {
      destination = entityId ? `/leads/${entityId}` : '/leads';
      destLabel = 'Lead details';
    } else if (type === 'FOLLOW_UP_REMINDER') {
      destination = '/followups';
      destLabel = 'Follow-ups';
    } else if (type === 'QUOTATION_APPROVED') {
      if (entityId) {
        ({ destination, destLabel } = await resolveQuotationDestination(entityId));
      } else {
        destination = '/quotations';
        destLabel = 'Quotations';
      }
    } else if (type === 'ORDER_CONFIRMED' || type === 'PAYMENT_RECEIVED') {
      destination = entityId ? `/orders/${entityId}` : '/orders';
      destLabel = 'Order details';
    } else if (type === 'DEAL_UPDATED') {
      destination = entityId ? `/leads/${entityId}` : '/leads';
      destLabel = 'Lead / Deal';
    } else {
      destination = '/approvals';
      destLabel = 'Approvals';
    }

    // Navigate first, then show the highlight banner on the new page — except
    // for quotation notifications, which already get an in-context ring
    // highlight on the specific quotation card, making the generic top
    // banner redundant duplicate messaging.
    router.push(destination);
    if (!destination.includes('?quotation=')) {
      // Slight delay so the new page has started mounting before banner shows
      setTimeout(() => showBanner(n.title, n.message, destLabel), 120);
    }
  };

  const markAllRead = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    await fetch('/api/notifications/read-all', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  // Initialise sidebar state from window width after mount (avoids SSR mismatch)
  useEffect(() => {
    setSidebarOpen(window.innerWidth >= 768);
  }, []);

  // Poll notifications every 30 s after user loads
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    fetchNotifications(token);
    const interval = setInterval(() => fetchNotifications(token), 30_000);
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

  // Close notification dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
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

  // ── notification highlight toast state ──────────────────────────────────
  const [notifBanner, setNotifBanner] = useState<{
    active: boolean;
    exiting: boolean;
    title: string;
    message: string;
    destination: string;
  }>({ active: false, exiting: false, title: '', message: '', destination: '' });

  const showBanner = (title: string, message: string, destination: string) => {
    setNotifBanner({ active: true, exiting: false, title, message, destination });
    // Begin exit animation 300ms before clearing
    setTimeout(() => setNotifBanner(b => ({ ...b, exiting: true })), 2700);
    setTimeout(() => setNotifBanner({ active: false, exiting: false, title: '', message: '', destination: '' }), 3000);
  };

  // Keep the loading screen up until the access-hours check has actually
  // come back — otherwise the real dashboard renders for one frame between
  // "user loaded" and "access-status resolved" before flipping to the
  // restricted screen, which flashes real data a blocked user shouldn't see.
  if (!user || !accessChecked) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (accessBlocked) {
    return <AccessRestrictedScreen blocked={accessBlocked} onLogout={handleLogout} />;
  }

  const roleInfo = ROLE_LABELS[user.role] || { label: user.role, color: 'bg-gray-100 text-gray-600' };
  // On desktop: full or icon-only. On mobile: overlay drawer or hidden.
  const showLabels = !desktopCollapsed;

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
                    className={`flex items-center gap-3 mx-2 px-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                    {showLabels && <span className="truncate">{item.label}</span>}
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
    <div className="flex h-screen bg-gray-50">
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
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
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
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
                <div className="absolute right-0 top-10 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <span className="text-sm font-semibold text-gray-800">Notifications</span>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-8">No notifications</p>
                    ) : notifications.map(n => (
                      <button
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer group ${
                          !n.isRead ? 'bg-blue-50 hover:bg-blue-100' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: n.isRead ? '#d1d5db' : '#3b82f6' }} />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-gray-800 truncate">{n.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                            <p className="text-[10px] text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}</p>
                          </div>
                          <svg className="w-3 h-3 text-gray-300 group-hover:text-gray-500 flex-shrink-0 mt-1 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${roleInfo.color}`}>
              {roleInfo.label}
            </span>
            <span className="text-sm text-gray-600 hidden sm:block truncate">{user.firstName} {user.lastName}</span>
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {user.firstName.charAt(0)}{(user.lastName || '').charAt(0)}
            </div>
          </div>
        </header>

        <main className={`flex-1 overflow-auto relative ${notifBanner.active ? 'notif-main-glow' : ''}`}>

          {/* ── Notification highlight banner ───────────────────────── */}
          {notifBanner.active && (
            <div
              className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 pointer-events-none ${
                notifBanner.exiting ? 'notif-toast-exit' : 'notif-toast-enter'
              }`}
            >
              <div className="pointer-events-auto bg-white border border-blue-100 rounded-2xl shadow-xl overflow-hidden">
                {/* Progress drain bar */}
                <div className="h-0.5 bg-blue-50">
                  <div className="h-full bg-blue-500 notif-drain" />
                </div>
                <div className="flex items-start gap-3 px-4 py-3">
                  {/* Bell icon */}
                  <div className="flex-shrink-0 mt-0.5 w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-blue-700 mb-0.5">Opened from notification</p>
                    <p className="text-sm font-bold text-gray-900 truncate">{notifBanner.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{notifBanner.message}</p>
                  </div>
                  {/* Destination chip */}
                  <div className="flex-shrink-0 flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2 py-1">
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                    {notifBanner.destination}
                  </div>
                  {/* Dismiss */}
                  <button
                    onClick={() => setNotifBanner(b => ({ ...b, exiting: true }))}
                    className="flex-shrink-0 ml-1 text-gray-300 hover:text-gray-500 transition-colors rounded-full p-0.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {children}
        </main>
      </div>
    </div>
  );
}
