'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SettingsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(u => {
        if (u.role !== 'ADMIN') {
          router.push('/dashboard');
          return;
        }
        setCurrentUser(u);
      })
      .catch(() => router.push('/login'));
  }, [router]);

  if (!currentUser) return <div className="p-6 text-center">Loading...</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Admin panel</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Management */}
        <Link href="/users" className="card p-6 hover:shadow-lg transition cursor-pointer border-l-4 border-blue-500">
          <div className="flex items-start justify-between mb-3">
            <h2 className="text-lg font-bold">User Management</h2>
            <span className="text-3xl">👤</span>
          </div>
          <p className="text-gray-600 text-sm mb-4">Manage system users, roles, and departments</p>
          <div className="text-xs text-gray-500 space-y-1">
            <p>✓ Create and edit users</p>
            <p>✓ Assign roles and managers</p>
            <p>✓ Activate/deactivate accounts</p>
          </div>
        </Link>

        {/* Announcements */}
        <Link href="/announcements" className="card p-6 hover:shadow-lg transition cursor-pointer border-l-4 border-green-500">
          <div className="flex items-start justify-between mb-3">
            <h2 className="text-lg font-bold">Announcements</h2>
            <span className="text-3xl">📢</span>
          </div>
          <p className="text-gray-600 text-sm mb-4">Create and manage company announcements</p>
          <div className="text-xs text-gray-500 space-y-1">
            <p>✓ Create announcements</p>
            <p>✓ Set priority levels</p>
            <p>✓ Publish to all users</p>
          </div>
        </Link>

        {/* Approvals */}
        <Link href="/approvals" className="card p-6 hover:shadow-lg transition cursor-pointer border-l-4 border-orange-500">
          <div className="flex items-start justify-between mb-3">
            <h2 className="text-lg font-bold">Approvals</h2>
            <span className="text-3xl">✅</span>
          </div>
          <p className="text-gray-600 text-sm mb-4">Review and approve/reject requests</p>
          <div className="text-xs text-gray-500 space-y-1">
            <p>✓ Lead deletion requests</p>
            <p>✓ Approve or reject</p>
            <p>✓ Add rejection reasons</p>
          </div>
        </Link>

        {/* Attendance */}
        <Link href="/attendance" className="card p-6 hover:shadow-lg transition cursor-pointer border-l-4 border-purple-500">
          <div className="flex items-start justify-between mb-3">
            <h2 className="text-lg font-bold">Attendance</h2>
            <span className="text-3xl">📅</span>
          </div>
          <p className="text-gray-600 text-sm mb-4">View employee attendance and activity</p>
          <div className="text-xs text-gray-500 space-y-1">
            <p>✓ Monthly attendance calendar</p>
            <p>✓ Login/logout times</p>
            <p>✓ Daily activities log</p>
          </div>
        </Link>
      </div>

      <div className="mt-8">
        <Link href="/dashboard" className="btn btn-secondary">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
