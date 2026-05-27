'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';

interface MenuItem {
  label: string;
  href: string;
  icon: string;
  roles?: string[]; // undefined = all roles
}

const MENU_ITEMS: MenuItem[] = [
  { label: 'Dashboard',   href: '/dashboard',   icon: '📊' },
  { label: 'Leads',       href: '/leads',        icon: '👥' },
  { label: 'Customers',   href: '/customers',    icon: '🏢' },
  { label: 'Pipeline',    href: '/pipeline',     icon: '📈' },
  { label: 'Quotations',  href: '/quotations',   icon: '📄' },
  { label: 'Orders',      href: '/orders',       icon: '📦' },
  { label: 'Tasks',       href: '/tasks',        icon: '✓' },
  { label: 'Support',     href: '/support',      icon: '🆘' },
  { label: 'Reports',     href: '/reports',      icon: '📊', roles: ['ADMIN', 'SALES_MANAGER'] },
  { label: 'Approvals',   href: '/approvals',    icon: '✅', roles: ['ADMIN', 'SALES_MANAGER'] },
  { label: 'Users',       href: '/users',        icon: '👤', roles: ['ADMIN'] },
  { label: 'Settings',    href: '/settings',     icon: '⚙️', roles: ['ADMIN'] },
];

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  ADMIN:         { label: 'Admin',    color: 'bg-red-100 text-red-700' },
  SALES_MANAGER: { label: 'Manager',  color: 'bg-blue-100 text-blue-700' },
  SALES_EXEC:    { label: 'Sales',    color: 'bg-green-100 text-green-700' },
  SUPPORT:       { label: 'Support',  color: 'bg-yellow-100 text-yellow-700' },
  VIEWER:        { label: 'Viewer',   color: 'bg-gray-100 text-gray-600' },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { router.push('/login'); return; }

    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(u => setUser(u))
      .catch(() => { localStorage.removeItem('token'); router.push('/login'); });
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  if (!user) return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>;

  const visibleItems = MENU_ITEMS.filter(item =>
    !item.roles || item.roles.includes(user.role)
  );

  const roleInfo = ROLE_LABELS[user.role] || { label: user.role, color: 'bg-gray-100 text-gray-600' };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col overflow-hidden`}>
        {/* Logo */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-center">
          {sidebarOpen ? (
            <div className="flex items-center gap-2">
              <Image src="/eOrbitor_logo.jpg" alt="Logo" width={36} height={36} className="rounded" />
              <div className="flex flex-col">
                <span className="font-bold text-sm leading-tight">eOrbitor</span>
                <span className="text-xs text-blue-600 font-semibold leading-tight">Pulse</span>
              </div>
            </div>
          ) : (
            <Image src="/eOrbitor_logo.jpg" alt="Logo" width={36} height={36} className="rounded" />
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span className="text-base w-5 text-center flex-shrink-0">{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User info + logout */}
        <div className="p-3 border-t border-gray-200">
          {sidebarOpen ? (
            <div className="mb-3 px-2">
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
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <span>⏻</span>
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
            ☰
          </button>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${roleInfo.color}`}>
              {roleInfo.label}
            </span>
            <span className="text-sm text-gray-600">{user.firstName} {user.lastName}</span>
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
