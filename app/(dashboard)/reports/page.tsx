'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRequireRole } from '@/lib/hooks/useRequireRole';

interface RecentReport {
  id: string;
  type: string;
  generatedAt: string;
  startDate: string;
  endDate: string;
}

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

type ReportType = 'personal' | 'team' | 'pipeline';
type QuickFilter = { label: string; days?: number; ytd?: boolean };

const REPORT_TYPES: { value: ReportType; label: string; description: string; icon: string }[] = [
  { value: 'personal', label: 'Personal Performance', description: 'Your sales metrics, win rate & revenue', icon: '👤' },
  { value: 'team', label: 'Team Performance', description: 'Leaderboard & aggregated team metrics', icon: '👥' },
  { value: 'pipeline', label: 'Pipeline Health', description: 'Deal stages, values & forecast', icon: '📊' },
];

const QUICK_FILTERS: QuickFilter[] = [
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 90 Days', days: 90 },
  { label: 'Year-to-Date', ytd: true },
];

const MANAGER_ROLES = ['SALES_MANAGER', 'ADMIN', 'SUPER_ADMIN'];

function isoDate(d: Date) {
  return d.toISOString().split('T')[0];
}

export default function ReportsPage() {
  const router = useRouter();
  // Reports are admin-only; managers and sales execs are redirected away.
  useRequireRole(['SUPER_ADMIN', 'ADMIN']);

  const [reportType, setReportType] = useState<ReportType>('personal');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [currentUser, setCurrentUser] = useState<UserOption | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [recentReports, setRecentReports] = useState<RecentReport[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('Last 30 Days');

  useEffect(() => {
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 30);
    setStartDate(isoDate(from));
    setEndDate(isoDate(today));
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        const [meRes, usersRes, reportsRes] = await Promise.all([
          fetch('/api/auth/me', { headers }),
          fetch('/api/users?active=true', { headers }),
          fetch('/api/reports/recent', { headers }),
        ]);

        if (meRes.ok) {
          const me = await meRes.json();
          setCurrentUser(me);
          setSelectedUserId(me.id);
        }

        if (usersRes.ok) {
          const data = await usersRes.json();
          const list: UserOption[] = Array.isArray(data) ? data : (data.users ?? []);
          setUsers(list);
        }

        if (reportsRes.ok) {
          setRecentReports(await reportsRes.json());
        }
      } catch (e) {
        console.error('Init error:', e);
      } finally {
        setLoadingInit(false);
      }
    };
    init();
  }, []);

  const applyQuickFilter = (filter: QuickFilter) => {
    const today = new Date();
    setActiveFilter(filter.label);
    if (filter.ytd) {
      setStartDate(isoDate(new Date(today.getFullYear(), 0, 1)));
    } else if (filter.days) {
      const from = new Date(today);
      from.setDate(from.getDate() - filter.days);
      setStartDate(isoDate(from));
    }
    setEndDate(isoDate(today));
  };

  const handleGenerate = async () => {
    setError('');
    if (!startDate || !endDate) {
      setError('Please select a date range.');
      return;
    }

    setGenerating(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ startDate, endDate });

      let endpoint = '';
      if (reportType === 'personal') {
        endpoint = '/api/reports/personal';
        params.set('userId', selectedUserId);
      } else if (reportType === 'team') {
        endpoint = '/api/reports/team';
        params.set('managerId', selectedUserId);
      } else {
        endpoint = '/api/reports/pipeline';
      }

      const res = await fetch(`${endpoint}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? 'Failed to generate report');
        return;
      }

      router.push(`/reports/${json.id}`);
    } catch (e: any) {
      setError(e.message ?? 'Unexpected error');
    } finally {
      setGenerating(false);
    }
  };

  const isManager = currentUser && MANAGER_ROLES.includes(currentUser.role);
  const showUserPicker = (reportType === 'personal' || reportType === 'team') && isManager;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">

        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Sales Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Generate detailed performance reports with custom date ranges</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Generate Form ── */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-800 mb-5">Generate New Report</h2>

              {/* Report type */}
              <div className="mb-6">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Report Type</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {REPORT_TYPES.map(rt => (
                    <button
                      key={rt.value}
                      onClick={() => setReportType(rt.value)}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        reportType === rt.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <p className="text-lg mb-1">{rt.icon}</p>
                      <p className="text-sm font-semibold text-gray-800">{rt.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{rt.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* User picker (managers only) */}
              {showUserPicker && (
                <div className="mb-6">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    {reportType === 'team' ? 'Viewing as Manager' : 'Select User'}
                  </p>
                  <select
                    value={selectedUserId}
                    onChange={e => setSelectedUserId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} · {u.role}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quick date filters */}
              <div className="mb-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick Filters</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_FILTERS.map(f => (
                    <button
                      key={f.label}
                      onClick={() => applyQuickFilter(f)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        activeFilter === f.label
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom date range */}
              <div className="mb-6">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Custom Range</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">From</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => { setStartDate(e.target.value); setActiveFilter(''); }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">To</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => { setEndDate(e.target.value); setActiveFilter(''); }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={generating || loadingInit || !startDate || !endDate}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {generating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating…
                  </span>
                ) : (
                  'Generate Report'
                )}
              </button>
            </div>
          </div>

          {/* ── Recent Reports sidebar ── */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Recent Reports</h3>
              {loadingInit ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : recentReports.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No reports yet</p>
              ) : (
                <div className="space-y-2">
                  {recentReports.map(r => (
                    <Link
                      key={r.id}
                      href={`/reports/${r.id}`}
                      className="block p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          r.type === 'PERSONAL' ? 'bg-blue-100 text-blue-700' :
                          r.type === 'TEAM' ? 'bg-green-100 text-green-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {r.type}
                        </span>
                        <span className="text-xs text-gray-400 group-hover:text-blue-500">View →</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1.5">
                        {new Date(r.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {' – '}
                        {new Date(r.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Tips card */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-800 mb-2">Report Tips</p>
              <ul className="text-xs text-blue-700 space-y-1.5 list-disc list-inside">
                <li>Use <strong>Last 30 Days</strong> for monthly review</li>
                <li>Use <strong>Year-to-Date</strong> for annual planning</li>
                <li>Team reports show ranked leaderboard</li>
                <li>Pipeline report shows all deal stages</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
