'use client';

import { useState, useEffect } from 'react';
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
      { label: 'Follow-ups', href: '/followups', icon: '🔔' },
      { label: 'Orders', href: '/orders', icon: '📦' },
      { label: 'Pipeline', href: '/pipeline', icon: '🗂️' },
    ],
  },
  {
    group: 'Customers',
    items: [
      { label: 'Customers', href: '/customers', icon: '🏢' },
    ],
  },
  {
    group: 'Tasks & Activity',
    items: [
      { label: 'Tasks', href: '/tasks', icon: '✓', roles: ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER', 'SALES_EXEC'] },
      { label: 'My Activity', href: '/daily-activity', icon: '📝' },
      { label: 'Team Activity', href: '/team-activity', icon: '👥', roles: ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER'] },
      { label: 'Attendance', href: '/attendance', icon: '📅', roles: ['SUPER_ADMIN', 'ADMIN'] },
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
      { label: 'Reports', href: '/reports', icon: '📊', roles: ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER'] },
      { label: 'Approvals', href: '/approvals', icon: '✅', roles: ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER'] },
      { label: 'Announcements', href: '/announcements', icon: '📢', roles: ['SUPER_ADMIN', 'ADMIN'] },
    ],
  },
  {
    group: 'Admin',
    roles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
    items: [
      { label: 'Users', href: '/users', icon: '👤', roles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'] },
      { label: 'Settings', href: '/settings', icon: '⚙️', roles: ['SUPER_ADMIN', 'ADMIN'] },
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState<any>(null);

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

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-60' : 'w-14'} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col overflow-hidden flex-shrink-0`}>
        {/* Logo */}
        <div className="p-3 border-b border-gray-200 flex items-center justify-center min-h-[56px]">
          {sidebarOpen ? (
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
                {sidebarOpen && (
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
                      title={!sidebarOpen ? item.label : undefined}
                      className={`flex items-center gap-3 mx-2 px-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                        active
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      <span className="text-base w-5 text-center flex-shrink-0">{item.icon}</span>
                      {sidebarOpen && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User info + logout */}
        <div className="p-3 border-t border-gray-200">
          {sidebarOpen ? (
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
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
          >
            ☰
          </button>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${roleInfo.color}`}>
              {roleInfo.label}
            </span>
            <span className="text-sm text-gray-600 hidden sm:block">{user.firstName} {user.lastName}</span>
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
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
