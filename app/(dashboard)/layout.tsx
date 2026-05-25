'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

const MENU_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: '📊' },
  { label: 'Leads', href: '/leads', icon: '👥' },
  { label: 'Customers', href: '/customers', icon: '🏢' },
  { label: 'Pipeline', href: '/pipeline', icon: '📈' },
  { label: 'Quotations', href: '/quotations', icon: '📄' },
  { label: 'Orders', href: '/orders', icon: '📦' },
  { label: 'Tasks', href: '/tasks', icon: '✓' },
  { label: 'Support', href: '/support', icon: '🆘' },
  { label: 'Reports', href: '/reports', icon: '📊' },
  { label: 'Settings', href: '/settings', icon: '⚙️' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Verify token and fetch user
    const verifyAuth = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          throw new Error('Unauthorized');
        }
        const userData = await res.json();
        setUser(userData);
      } catch (err) {
        localStorage.removeItem('token');
        router.push('/login');
      }
    };

    verifyAuth();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  if (!user) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-white border-r border-gray-200 transition-all duration-300 overflow-y-auto`}
      >
        {/* Logo */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-center">
          {sidebarOpen ? (
            <div className="flex items-center gap-2">
              <Image
                src="/eOrbitor_logo.jpg"
                alt="Logo"
                width={40}
                height={40}
                className="rounded"
              />
              <span className="font-bold text-sm">eOrbitor</span>
            </div>
          ) : (
            <Image
              src="/eOrbitor_logo.jpg"
              alt="Logo"
              width={40}
              height={40}
              className="rounded"
            />
          )}
        </div>

        {/* Menu Items */}
        <nav className="p-4 space-y-2">
          {MENU_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            >
              <span className="text-lg w-6 text-center">{item.icon}</span>
              {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          ))}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-gray-200 mt-auto">
          <button
            onClick={handleLogout}
            className="btn btn-secondary w-full text-sm"
          >
            {sidebarOpen ? 'Logout' : '⏻'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            ☰
          </button>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user.firstName} {user.lastName}</span>
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
              {user.firstName.charAt(0)}{user.lastName.charAt(0)}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
