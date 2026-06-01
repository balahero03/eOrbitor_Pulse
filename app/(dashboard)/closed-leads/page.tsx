'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const TABS = [
  { key: '',        label: 'All Closed',  icon: '📊', color: 'text-gray-700' },
  { key: 'ORDER',   label: 'Won → Orders', icon: '🏆', color: 'text-green-700' },
  { key: 'LOST',    label: 'Lost',        icon: '❌', color: 'text-red-700' },
  { key: 'DROPPED', label: 'Dropped',     icon: '🚫', color: 'text-gray-600' },
];

const STATUS_STYLES: Record<string, string> = {
  ORDER:   'bg-green-100 text-green-800 border-green-200',
  WON:     'bg-green-100 text-green-800 border-green-200',
  LOST:    'bg-red-100 text-red-700 border-red-200',
  DROPPED: 'bg-gray-100 text-gray-600 border-gray-200',
};

const fmt = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export default function ClosedLeadsPage() {
  const [tab, setTab] = useState('');
  const [leads, setLeads] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);

  useEffect(() => {
    setPage(1);
  }, [tab, search, from, to]);

  useEffect(() => {
    fetchLeads();
  }, [tab, search, from, to, page]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(tab && { outcome: tab }),
        ...(search && { search }),
        ...(from && { from }),
        ...(to && { to }),
      });
      const res = await fetch(`/api/leads/closed?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLeads(data.leads);
      setStats(data.stats);
      setPagination(data.pagination);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const totalWonValue = stats ? stats.won.value + stats.order.value : 0;
  const totalWonCount = stats ? stats.won.count + stats.order.count : 0;
  const totalLostValue = stats ? stats.lost.value + stats.dropped.value : 0;
  const totalLostCount = stats ? stats.lost.count + stats.dropped.count : 0;
  const winRate = totalWonCount + totalLostCount > 0
    ? ((totalWonCount / (totalWonCount + totalLostCount)) * 100).toFixed(1)
    : '0';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Closed Leads</h1>
          <p className="text-sm text-gray-500">Won, Lost and Dropped opportunities</p>
        </div>
        <Link href="/leads" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
          ← Active Leads
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <p className="text-xs text-gray-500 uppercase font-medium">Won (incl. Orders)</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{totalWonCount}</p>
          <p className="text-sm text-green-700 font-medium mt-1">{fmt(totalWonValue)}</p>
        </div>
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <p className="text-xs text-gray-500 uppercase font-medium">Lost</p>
          <p className="text-3xl font-bold text-red-600 mt-1">{stats?.lost.count ?? 0}</p>
          <p className="text-sm text-red-700 font-medium mt-1">{fmt(stats?.lost.value ?? 0)}</p>
        </div>
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <p className="text-xs text-gray-500 uppercase font-medium">Dropped</p>
          <p className="text-3xl font-bold text-gray-600 mt-1">{stats?.dropped.count ?? 0}</p>
          <p className="text-sm text-gray-500 mt-1">{fmt(stats?.dropped.value ?? 0)}</p>
        </div>
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <p className="text-xs text-gray-500 uppercase font-medium">Win Rate</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">{winRate}%</p>
          <p className="text-sm text-gray-500 mt-1">{totalWonCount + totalLostCount} total closed</p>
        </div>
      </div>

      {/* Tabs + filters */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="flex items-center justify-between px-5 pt-4 pb-0 border-b border-gray-100">
          <div className="flex gap-1">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 ${
                  tab === t.key
                    ? 'border-blue-600 text-blue-700 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, company…"
            className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]"
          />
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
            title="Closed from"
          />
          <input
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
            title="Closed to"
          />
          {(search || from || to) && (
            <button
              onClick={() => { setSearch(''); setFrom(''); setTo(''); }}
              className="px-3 py-2 text-sm text-gray-500 border rounded-lg hover:bg-gray-50"
            >
              Clear
            </button>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-gray-500 font-medium">No closed leads found</p>
            <p className="text-sm text-gray-400 mt-1">Closed leads will appear here after CLOSURE stage</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Lead</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Company</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Outcome</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Value</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Closed By</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Closed On</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Reason</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map(lead => (
                    <tr key={lead.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-gray-900">{lead.name}</td>
                      <td className="px-4 py-3 text-gray-600">{lead.company}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${STATUS_STYLES[lead.status] || 'bg-gray-100 text-gray-600'}`}>
                          {lead.status === 'ORDER' ? '🏆 Won → Order' : lead.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800">
                        {lead.quoteValue ? fmt(Number(lead.quoteValue)) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {lead.assignedTo?.firstName} {lead.assignedTo?.lastName}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {lead.closedAt ? fmtDate(lead.closedAt) : fmtDate(lead.updatedAt)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-[180px]">
                        <span className="truncate block" title={lead.closureReason || ''}>
                          {lead.closureReason || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/leads/${lead.id}`}
                          className="text-xs text-blue-600 hover:underline font-medium">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  {pagination.total} total · page {pagination.page} of {pagination.pages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => p - 1)}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50"
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= pagination.pages}
                    className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
