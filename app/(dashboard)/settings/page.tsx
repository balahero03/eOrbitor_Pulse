'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Settings {
  systemStats: {
    totalUsers: number;
    totalLeads: number;
    totalCustomers: number;
    totalDeals: number;
  };
  emailConfig: {
    provider: string;
    host: string;
    port: string | number;
    senderEmail: string;
  };
  features: {
    realTimeNotifications: boolean;
    activityLogging: boolean;
    roleBasedAccess: boolean;
    emailNotifications: boolean;
  };
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch settings');

      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  if (!settings) {
    return <div className="p-6 text-center">No settings available</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Settings & Administration</h1>

      {/* System Overview */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm font-medium">Total Users</p>
          <p className="text-3xl font-bold text-blue-700">{settings.systemStats.totalUsers}</p>
        </div>
        <div className="card p-6 bg-gradient-to-br from-green-50 to-green-100 border-l-4 border-green-500">
          <p className="text-gray-600 text-sm font-medium">Total Leads</p>
          <p className="text-3xl font-bold text-green-700">{settings.systemStats.totalLeads}</p>
        </div>
        <div className="card p-6 bg-gradient-to-br from-purple-50 to-purple-100 border-l-4 border-purple-500">
          <p className="text-gray-600 text-sm font-medium">Total Customers</p>
          <p className="text-3xl font-bold text-purple-700">{settings.systemStats.totalCustomers}</p>
        </div>
        <div className="card p-6 bg-gradient-to-br from-orange-50 to-orange-100 border-l-4 border-orange-500">
          <p className="text-gray-600 text-sm font-medium">Total Deals</p>
          <p className="text-3xl font-bold text-orange-700">{settings.systemStats.totalDeals}</p>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* User Management */}
        <Link href="/settings/users" className="card p-6 hover:shadow-lg transition block">
          <div className="flex items-start justify-between mb-3">
            <h2 className="text-lg font-bold">User Management</h2>
            <span className="text-2xl">👤</span>
          </div>
          <p className="text-gray-600 text-sm mb-4">Manage system users, roles, and permissions</p>
          <ul className="text-sm space-y-1 text-gray-600">
            <li>✓ Create and edit users</li>
            <li>✓ Assign roles and departments</li>
            <li>✓ Manage permissions</li>
          </ul>
        </Link>

        {/* Activity Logs */}
        <Link href="/settings/activity" className="card p-6 hover:shadow-lg transition block">
          <div className="flex items-start justify-between mb-3">
            <h2 className="text-lg font-bold">Activity Logs</h2>
            <span className="text-2xl">📋</span>
          </div>
          <p className="text-gray-600 text-sm mb-4">View system audit trail and user actions</p>
          <ul className="text-sm space-y-1 text-gray-600">
            <li>✓ Track all user actions</li>
            <li>✓ View changes history</li>
            <li>✓ Filter by user/entity</li>
          </ul>
        </Link>

        {/* Company Settings */}
        <Link href="/settings/company" className="card p-6 hover:shadow-lg transition block">
          <div className="flex items-start justify-between mb-3">
            <h2 className="text-lg font-bold">Company Settings</h2>
            <span className="text-2xl">🏢</span>
          </div>
          <p className="text-gray-600 text-sm mb-4">Configure company information and system settings</p>
          <ul className="text-sm space-y-1 text-gray-600">
            <li>✓ Email configuration</li>
            <li>✓ Company details</li>
            <li>✓ System preferences</li>
          </ul>
        </Link>

        {/* System Features */}
        <div className="card p-6 bg-blue-50">
          <div className="flex items-start justify-between mb-3">
            <h2 className="text-lg font-bold">System Features</h2>
            <span className="text-2xl">⚙️</span>
          </div>
          <p className="text-gray-600 text-sm mb-4">Enabled system features</p>
          <ul className="text-sm space-y-1">
            <li className={settings.features.realTimeNotifications ? 'text-green-600' : 'text-gray-500'}>
              ✓ Real-time Notifications
            </li>
            <li className={settings.features.activityLogging ? 'text-green-600' : 'text-gray-500'}>
              ✓ Activity Logging
            </li>
            <li className={settings.features.roleBasedAccess ? 'text-green-600' : 'text-gray-500'}>
              ✓ Role-based Access Control
            </li>
            <li className={settings.features.emailNotifications ? 'text-green-600' : 'text-gray-500'}>
              ✓ Email Notifications
            </li>
          </ul>
        </div>
      </div>

      {/* Email Configuration */}
      <div className="card p-6">
        <h2 className="text-xl font-bold mb-4">Email Configuration</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">Provider</p>
            <p className="font-medium">{settings.emailConfig.provider}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">SMTP Host</p>
            <p className="font-medium">{settings.emailConfig.host}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">SMTP Port</p>
            <p className="font-medium">{settings.emailConfig.port}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Sender Email</p>
            <p className="font-medium">{settings.emailConfig.senderEmail}</p>
          </div>
        </div>
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
          💡 Email configuration is read from environment variables. Update .env.local to change settings.
        </div>
      </div>
    </div>
  );
}
