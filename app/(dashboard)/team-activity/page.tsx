'use client';

import { useState, useEffect } from 'react';
import { useRequireRole } from '@/lib/hooks/useRequireRole';

interface TeamActivity {
  id: string;
  userId: string;
  date: string;
  activities: string[];
  notes: string | null;
  user: { id: string; firstName: string; lastName: string; email: string; role: string };
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN:         'bg-red-100 text-red-700',
  SALES_MANAGER: 'bg-blue-100 text-blue-700',
  SALES_EXEC:    'bg-green-100 text-green-700',
  SUPPORT:       'bg-yellow-100 text-yellow-700',
  VIEWER:        'bg-gray-100 text-gray-600',
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin', SALES_MANAGER: 'Manager', SALES_EXEC: 'Sales', SUPPORT: 'Support', VIEWER: 'Viewer',
};

function avatarColor(role: string) {
  const map: Record<string, string> = {
    ADMIN: 'bg-red-500', SALES_MANAGER: 'bg-blue-500',
    SALES_EXEC: 'bg-green-500', SUPPORT: 'bg-yellow-500',
  };
  return map[role] || 'bg-gray-400';
}

export default function TeamActivityPage() {
  useRequireRole(['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER']);
  const [activities, setActivities] = useState<TeamActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { fetchActivities(); }, [selectedDate]);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/daily-activity/team?date=${selectedDate}&mode=day`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setActivities(data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = activities.filter(a => {
    const name = `${a.user.firstName} ${a.user.lastName}`.toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase()) || a.user.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = !roleFilter || a.user.role === roleFilter;
    return matchSearch && matchRole;
  });

  const totalActivities = filtered.reduce((s, a) => s + a.activities.length, 0);

  const dateLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Team Activity Report</h1>
          <p className="text-sm text-gray-500 mt-1">{dateLabel}</p>
        </div>
        <input
          type="date"
          value={selectedDate}
          max={new Date().toISOString().slice(0, 10)}
          onChange={e => { setSelectedDate(e.target.value); setExpanded(null); }}
          className="border rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 border-l-4 border-green-500 bg-green-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Members Reported</p>
          <p className="text-4xl font-bold text-green-700 mt-1">{filtered.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 border-l-4 border-purple-500 bg-purple-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Activities</p>
          <p className="text-4xl font-bold text-purple-700 mt-1">{totalActivities}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-48"
        />
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Roles</option>
          <option value="SALES_MANAGER">Manager</option>
          <option value="SALES_EXEC">Sales</option>
          <option value="SUPPORT">Support</option>
        </select>
        {(search || roleFilter) && (
          <button onClick={() => { setSearch(''); setRoleFilter(''); }} className="text-xs text-gray-400 hover:text-gray-600">
            Clear
          </button>
        )}
        <span className="ml-auto text-sm text-gray-500">{filtered.length} records</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center text-gray-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-gray-500">No activity reported for this date</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-5 py-3 text-left font-semibold text-gray-600">Employee</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-600">Role</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-600">Activities</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-600">Notes</th>
                <th className="px-5 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(a => (
                <>
                  <tr
                    key={a.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                  >
                    {/* Employee */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${avatarColor(a.user.role)}`}>
                          {a.user.firstName[0]}{a.user.lastName[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{a.user.firstName} {a.user.lastName}</p>
                          <p className="text-xs text-gray-400">{a.user.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[a.user.role] || 'bg-gray-100 text-gray-600'}`}>
                        {ROLE_LABELS[a.user.role] || a.user.role}
                      </span>
                    </td>

                    {/* Activity count */}
                    <td className="px-5 py-4">
                      {a.activities.length > 0
                        ? <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">{a.activities.length} tasks</span>
                        : <span className="text-gray-400 text-xs">None</span>}
                    </td>

                    {/* Notes indicator */}
                    <td className="px-5 py-4">
                      {a.notes
                        ? <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Has notes</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>

                    {/* Expand toggle */}
                    <td className="px-4 py-4 text-gray-400 text-xs text-center">
                      {expanded === a.id ? '▲' : '▼'}
                    </td>
                  </tr>

                  {/* Expanded row */}
                  {expanded === a.id && (
                    <tr key={`${a.id}-detail`}>
                      <td colSpan={5} className="px-6 py-5 bg-gray-50 border-t border-gray-100">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Activities */}
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Tasks / Activities</p>
                            {a.activities.length === 0 ? (
                              <p className="text-sm text-gray-400 italic">No activities recorded</p>
                            ) : (
                              <ol className="space-y-2">
                                {a.activities.map((act, i) => (
                                  <li key={i} className="flex gap-2 text-sm text-gray-700 bg-white rounded-lg px-3 py-2 border border-blue-100">
                                    <span className="text-blue-500 font-bold shrink-0">{i + 1}.</span>
                                    {act}
                                  </li>
                                ))}
                              </ol>
                            )}
                          </div>

                          {/* Notes */}
                          {a.notes && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Notes</p>
                              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                <p className="text-sm text-amber-900">{a.notes}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
