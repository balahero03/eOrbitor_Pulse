'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface FollowUp {
  id: string;
  type: string;
  scheduledDate: string;
  actualDate?: string;
  durationMinutes?: number;
  notes?: string;
  outcome?: string;
  deal: { id: string; dealName: string; customer: { companyName: string } };
  lead?: { id: string; name: string; company?: string };
  createdBy: { id: string; firstName: string; lastName: string };
  createdAt: string;
}

const TYPE_ICONS: Record<string, string> = {
  CALL: '📞', EMAIL: '📧', MEETING: '👥', WHATSAPP: '💬', SITE_VISIT: '📍',
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

const isOverdue = (d: string, done: boolean) => !done && new Date(d) < new Date();
const isToday = (d: string) => new Date(d).toDateString() === new Date().toDateString();
const isTomorrow = (d: string) => {
  const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
  return new Date(d).toDateString() === tmr.toDateString();
};

const todayStr = () => new Date().toISOString().split('T')[0];
const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; };
const weekEndStr = () => { const d = new Date(); d.setDate(d.getDate() + 6); return d.toISOString().split('T')[0]; };

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [quickFilter, setQuickFilter] = useState('');

  // Calendar
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const resetPage = () => setPage(1);

  const applyQuick = (key: string) => {
    setQuickFilter(key);
    setStatus('');
    if (key === 'today') {
      setFromDate(todayStr()); setToDate(todayStr());
    } else if (key === 'tomorrow') {
      setFromDate(tomorrowStr()); setToDate(tomorrowStr());
    } else if (key === 'this_week') {
      setFromDate(todayStr()); setToDate(weekEndStr());
    } else if (key === 'overdue') {
      setFromDate(''); setToDate(''); setStatus('overdue');
    } else {
      setFromDate(''); setToDate('');
    }
    resetPage();
  };

  const clearFilters = () => {
    setSearch(''); setType(''); setStatus('');
    setFromDate(''); setToDate(''); setQuickFilter('');
    setPage(1);
  };

  const fetchFollowUps = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ page: page.toString(), limit: '50' });
      if (type) params.set('type', type);
      if (status) params.set('status', status);
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
      if (search) params.set('search', search);

      const res = await fetch(`/api/followups?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFollowUps(data.followUps);
      setPagination(data.pagination);
    } catch { } finally { setLoading(false); }
  }, [page, type, status, fromDate, toDate, search]);

  useEffect(() => { fetchFollowUps(); }, [fetchFollowUps]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this follow-up?')) return;
    const res = await fetch(`/api/followups/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    if (res.ok) setFollowUps(prev => prev.filter(f => f.id !== id));
  };

  // Calendar helpers
  const getFollowUpsForDate = (date: Date) =>
    followUps.filter(f => new Date(f.scheduledDate).toDateString() === date.toDateString());

  const renderCalendar = () => {
    const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
    const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} className="bg-gray-50 h-24" />);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), d);
      const fups = getFollowUpsForDate(date);
      const today = date.toDateString() === new Date().toDateString();
      cells.push(
        <div key={d} className={`border border-gray-100 h-24 p-1.5 ${today ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
          <p className={`text-xs font-bold mb-1 ${today ? 'text-blue-700' : 'text-gray-600'}`}>{d}</p>
          <div className="space-y-0.5">
            {fups.slice(0, 2).map(f => (
              <div key={f.id} title={`${f.deal.customer.companyName} — ${fmtTime(f.scheduledDate)}`}
                className={`text-[10px] px-1 py-0.5 rounded truncate ${isOverdue(f.scheduledDate, !!f.actualDate) ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                {TYPE_ICONS[f.type]} {f.deal.customer.companyName}
              </div>
            ))}
            {fups.length > 2 && <p className="text-[10px] text-gray-400">+{fups.length - 2} more</p>}
          </div>
        </div>
      );
    }
    return cells;
  };

  const hasFilters = search || type || status || fromDate || toDate;
  const counts = {
    today: followUps.filter(f => isToday(f.scheduledDate)).length,
    overdue: followUps.filter(f => isOverdue(f.scheduledDate, !!f.actualDate)).length,
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Follow-ups</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track all scheduled follow-up activities</p>
        </div>
        <Link href="/followups/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
          + Schedule Follow-up
        </Link>
      </div>

      {/* Quick filter chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: '',           label: 'All',        icon: '📋' },
          { key: 'today',      label: 'Today',      icon: '📅' },
          { key: 'tomorrow',   label: 'Tomorrow',   icon: '🗓️' },
          { key: 'this_week',  label: 'This Week',  icon: '📆' },
          { key: 'overdue',    label: 'Overdue',    icon: '⚠️' },
        ].map(q => (
          <button key={q.key} onClick={() => applyQuick(q.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              quickFilter === q.key
                ? q.key === 'overdue'
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-700'
            }`}>
            {q.icon} {q.label}
            {q.key === 'today' && counts.today > 0 && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${quickFilter === 'today' ? 'bg-white text-blue-700' : 'bg-blue-100 text-blue-700'}`}>
                {counts.today}
              </span>
            )}
            {q.key === 'overdue' && counts.overdue > 0 && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${quickFilter === 'overdue' ? 'bg-white text-red-600' : 'bg-red-100 text-red-700'}`}>
                {counts.overdue}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters + View toggle */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <input type="text" value={search} onChange={e => { setSearch(e.target.value); resetPage(); }}
              placeholder="Customer, lead, notes..."
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
            <select value={type} onChange={e => { setType(e.target.value); resetPage(); }}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
              <option value="">All Types</option>
              <option value="CALL">📞 Call</option>
              <option value="EMAIL">📧 Email</option>
              <option value="MEETING">👥 Meeting</option>
              <option value="WHATSAPP">💬 WhatsApp</option>
              <option value="SITE_VISIT">📍 Site Visit</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select value={status} onChange={e => { setStatus(e.target.value); setQuickFilter(''); resetPage(); }}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>

          {/* Date range */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
            <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setQuickFilter(''); resetPage(); }}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
            <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setQuickFilter(''); resetPage(); }}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>

          {/* Clear */}
          {hasFilters && (
            <button onClick={clearFilters}
              className="px-3 py-2 text-sm text-gray-500 border rounded-lg hover:bg-gray-50">
              Clear
            </button>
          )}

          {/* View toggle */}
          <div className="ml-auto flex gap-1 bg-gray-100 rounded-lg p-1">
            <button onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              ☰ List
            </button>
            <button onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${viewMode === 'calendar' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              📅 Calendar
            </button>
          </div>
        </div>
      </div>

      {/* List View */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : followUps.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-gray-500 font-medium">No follow-ups found</p>
              {hasFilters && <button onClick={clearFilters} className="mt-3 text-blue-600 text-sm hover:underline">Clear filters</button>}
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-28">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-40">Scheduled</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-24">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Notes</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-20">By</th>
                    <th className="px-4 py-3 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {followUps.map(f => {
                    const done = !!f.actualDate;
                    const overdue = isOverdue(f.scheduledDate, done);
                    const today = isToday(f.scheduledDate);
                    const tomorrow = isTomorrow(f.scheduledDate);
                    return (
                      <tr key={f.id} className={`hover:bg-gray-50 transition-colors ${overdue ? 'bg-red-50/40' : ''}`}>
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                            {TYPE_ICONS[f.type]} {f.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-gray-900">{f.deal.customer.companyName}</p>
                          {f.lead && <p className="text-xs text-gray-400 mt-0.5">{f.lead.name}</p>}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="font-medium text-gray-900">{fmtDate(f.scheduledDate)}</p>
                              <p className="text-xs text-gray-400">{fmtTime(f.scheduledDate)}</p>
                            </div>
                            {today && !done && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full font-semibold whitespace-nowrap">Today</span>
                            )}
                            {tomorrow && !done && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full font-semibold whitespace-nowrap">Tomorrow</span>
                            )}
                            {overdue && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full font-semibold whitespace-nowrap">Overdue</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          {done ? (
                            <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">✓ Done</span>
                          ) : overdue ? (
                            <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full font-medium">Overdue</span>
                          ) : (
                            <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full font-medium">Pending</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-gray-500 max-w-[180px]">
                          <p className="truncate text-xs" title={f.notes || ''}>{f.notes || '—'}</p>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-400">
                          {f.createdBy.firstName}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex gap-2">
                            <Link href={`/followups/${f.id}`} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit</Link>
                            <button onClick={() => handleDelete(f.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Del</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              {pagination && pagination.pages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                  <p className="text-sm text-gray-500">
                    {pagination.total} results · page {page} of {pagination.pages}
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
                      className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50">← Prev</button>
                    <button onClick={() => setPage(p => p + 1)} disabled={page >= pagination.pages}
                      className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50">Next →</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
              className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50">← Prev</button>
            <div className="text-center">
              <h2 className="text-lg font-bold text-gray-900">
                {calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h2>
              <button onClick={() => setCalendarMonth(new Date())} className="text-xs text-blue-600 hover:underline">Today</button>
            </div>
            <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
              className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50">Next →</button>
          </div>
          <div className="grid grid-cols-7 border-t border-l border-gray-100">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="border-r border-b border-gray-100 p-2 text-center text-xs font-bold text-gray-400 bg-gray-50">{d}</div>
            ))}
            {renderCalendar()}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 inline-block" /> Scheduled</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 inline-block" /> Overdue</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-50 border border-blue-200 inline-block" /> Today</span>
          </div>
        </div>
      )}
    </div>
  );
}
