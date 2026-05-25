'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface CompanySettings {
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

export default function CompanySettingsPage() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('eOrbitor Pulse');
  const [companyEmail, setCompanyEmail] = useState('');

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Company Settings</h1>
        <Link href="/settings" className="btn btn-secondary">Back to Settings</Link>
      </div>

      {/* Company Information */}
      <div className="card p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Company Information</h2>
        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Company Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full max-w-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Company Email</label>
            <input
              type="email"
              value={companyEmail}
              onChange={(e) => setCompanyEmail(e.target.value)}
              placeholder="contact@company.local"
              className="w-full max-w-md"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button type="button" className="btn btn-primary" disabled>
              Save Settings (Read-only mode)
            </button>
          </div>
        </form>
      </div>

      {/* System Statistics */}
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

      {/* Email Configuration */}
      <div className="card p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Email Configuration</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
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
        <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
          💡 Email configuration is managed via environment variables in .env.local
        </div>
      </div>

      {/* System Features */}
      <div className="card p-6">
        <h2 className="text-xl font-bold mb-4">System Features</h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${settings.features.realTimeNotifications ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <div>
              <p className="font-medium">Real-time Notifications</p>
              <p className="text-sm text-gray-600">{settings.features.realTimeNotifications ? 'Enabled' : 'Disabled'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${settings.features.activityLogging ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <div>
              <p className="font-medium">Activity Logging</p>
              <p className="text-sm text-gray-600">{settings.features.activityLogging ? 'Enabled' : 'Disabled'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${settings.features.roleBasedAccess ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <div>
              <p className="font-medium">Role-based Access Control</p>
              <p className="text-sm text-gray-600">{settings.features.roleBasedAccess ? 'Enabled' : 'Disabled'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${settings.features.emailNotifications ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            <div>
              <p className="font-medium">Email Notifications</p>
              <p className="text-sm text-gray-600">{settings.features.emailNotifications ? 'Enabled' : 'Disabled'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
