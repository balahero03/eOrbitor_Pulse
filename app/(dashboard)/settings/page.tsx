'use client';

export default function SettingsPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <a href="/settings/company" className="card p-6 hover:shadow-md transition-shadow">
          <h3 className="font-bold mb-2">Company Settings</h3>
          <p className="text-gray-600 text-sm">Configure organization details, GST, timezone</p>
        </a>
        <a href="/settings/users" className="card p-6 hover:shadow-md transition-shadow">
          <h3 className="font-bold mb-2">User Management</h3>
          <p className="text-gray-600 text-sm">Manage users, roles, and permissions</p>
        </a>
      </div>
    </div>
  );
}
