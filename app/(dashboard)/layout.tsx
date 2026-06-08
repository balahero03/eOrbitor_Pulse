'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';

interface MenuItem {
  label: string;
  href: string;
  icon: string;
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
}

const NAV_GROUPS: NavGroup[] = [
  {
    group: 'Main',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: '📊' },
    ],
  },
  {
    group: 'Sales',
    roles: ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER', 'SALES_EXEC'],
    items: [
      { label: 'Leads', href: '/leads', icon: '🎯' },
      { label: 'Closed Leads', href: '/closed-leads', icon: '📁' },
      { label: 'Customers', href: '/customers', icon: '🏢' },
      { label: 'Follow-ups', href: '/followups', icon: '🔔' },
      { label: 'Orders', href: '/orders', icon: '📦' },
    ],
  },
  {
    group: 'Tasks & Activity',
    items: [
      { label: 'Tasks', href: '/tasks', icon: '✓', roles: ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER', 'SALES_EXEC'] },
      { label: 'My Activity', href: '/daily-activity', icon: '📝' },
      { label: 'Attendance', href: '/attendance', icon: '📅', roles: ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER'] },
    ],
  },
  {
    group: 'Analytics',
    roles: ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER', 'SALES_EXEC'],
    items: [
      { label: 'Reports', href: '/reports', icon: '📈' },
    ],
  },
  {
    group: 'Catalog',
    roles: ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER', 'SALES_EXEC'],
    items: [
      { label: 'Products', href: '/products', icon: '🗂️' },
    ],
  },
  {
    group: 'Management',
    roles: ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER'],
    items: [
      { label: 'Approvals', href: '/approvals', icon: '✅', roles: ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER'] },
      { label: 'Announcements', href: '/announcements', icon: '📢', roles: ['SUPER_ADMIN', 'ADMIN'] },
    ],
  },
  {
    group: 'Admin',
    roles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
    items: [
      { label: 'Users', href: '/users', icon: '👤', roles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'] },
    ],
  },
];

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  SUPER_ADMIN:   { label: 'Super Admin', color: 'bg-purple-100 text-purple-700' },
  ADMIN:         { label: 'Admin',       color: 'bg-red-100 text-red-700' },
  SALES_MANAGER: { label: 'Manager',     color: 'bg-blue-100 text-blue-700' },
  SALES_EXEC:    { label: 'Sales',       color: 'bg-green-100 text-green-700' },
  SUPPORT:       { label: 'Support',     color: 'bg-yellow-100 text-yellow-700' },
  VIEWER:        { label: 'Viewer',      color: 'bg-gray-100 text-gray-600' },
};

function isItemVisible(item: MenuItem, role: string): boolean {
  return !item.roles || item.roles.includes(role);
}

function isGroupVisible(group: NavGroup, role: string): boolean {
  if (group.roles && !group.roles.includes(role)) return false;
  return group.items.some((item) => isItemVisible(item, role));
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [user, setUser] = useState<any>(null);
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

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  const roleInfo = ROLE_LABELS[user.role] || { label: user.role, color: 'bg-gray-100 text-gray-600' };
  // On desktop: full or icon-only. On mobile: overlay drawer or hidden.
  const showLabels = !desktopCollapsed;

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="p-3 border-b border-gray-200 flex items-center justify-center min-h-[56px]">
        {showLabels ? (
          <div className="flex items-center gap-2">
            <Image src="/eOrbitor_logo.jpg" alt="Logo" width={32} height={32} className="rounded" />
            <div className="flex flex-col">
              <span className="font-bold text-sm leading-tight">eOrbitor</span>
              <span className="text-xs text-blue-600 font-semibold leading-tight">Pulse</span>
            </div>
          </div>
        ) : (
          <Image src="/eOrbitor_logo.jpg" alt="Logo" width={32} height={32} className="rounded" />
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
                    <span className="text-base w-5 text-center flex-shrink-0">{item.icon}</span>
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
            <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${roleInfo.color}`}>
              {roleInfo.label}
            </span>
          </div>
        ) : null}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <span>⏻</span>
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
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
            aria-label="Toggle sidebar"
          >
            ☰
          </button>
          <div className="flex items-center gap-3 min-w-0">
            {/* Notification bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(o => !o)}
                className="relative p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                aria-label="Notifications"
              >
                🔔
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
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
                        onClick={() => markRead(n.id)}
                        className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${!n.isRead ? 'bg-blue-50' : ''}`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 w-2 h-2 rounded-full flex-shrink-0" style={{ background: n.isRead ? '#d1d5db' : '#3b82f6', marginTop: 6 }} />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">{n.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                            <p className="text-[10px] text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
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

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
