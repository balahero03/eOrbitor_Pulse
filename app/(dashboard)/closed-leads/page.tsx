'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { InboxIcon } from '@heroicons/react/24/outline';

const TABS = [
  { key: '',        label: 'All Closed' },
  { key: 'WON',     label: 'Won → Orders' },
  { key: 'LOST',    label: 'Lost' },
  { key: 'DROPPED', label: 'Dropped' },
];

const STATUS_META: Record<string, { label: string; style: string }> = {
  ORDER:   { label: 'Won → Order', style: 'bg-green-100 text-green-800 border-green-200' },
  WON:     { label: 'Won → Order', style: 'bg-green-100 text-green-800 border-green-200' },
  LOST:    { label: 'Lost',        style: 'bg-red-100 text-red-700 border-red-200' },
  DROPPED: { label: 'Dropped',     style: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const fmt = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export default function ClosedLeadsPage() {
  const router = useRouter();
  const [tab, setTab] = useState('');
  const [leads, setLeads] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);

  useEffect(() => { setPage(1); }, [tab, search, from, to]);

  useEffect(() => { fetchLeads(); }, [tab, search, from, to, page]);

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

  const totalWonCount = stats ? (stats.won?.count ?? 0) + (stats.order?.count ?? 0) : 0;
  const totalWonValue = stats ? (stats.won?.value ?? 0) + (stats.order?.value ?? 0) : 0;
  const totalLostCount = stats ? (stats.lost?.count ?? 0) + (stats.dropped?.count ?? 0) : 0;
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
        <div className="bg-white rounded-xl border p-5 shadow-sm cursor-pointer hover:border-green-300 transition-colors" onClick={() => setTab('WON')}>
          <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">Won (incl. Orders)</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{totalWonCount}</p>
          <p className="text-sm text-green-700 font-medium mt-1">{fmt(totalWonValue)}</p>
        </div>
        <div className="bg-white rounded-xl border p-5 shadow-sm cursor-pointer hover:border-red-300 transition-colors" onClick={() => setTab('LOST')}>
          <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">Lost</p>
          <p className="text-3xl font-bold text-red-600 mt-1">{stats?.lost?.count ?? 0}</p>
          <p className="text-sm text-red-700 font-medium mt-1">{fmt(stats?.lost?.value ?? 0)}</p>
        </div>
        <div className="bg-white rounded-xl border p-5 shadow-sm cursor-pointer hover:border-gray-400 transition-colors" onClick={() => setTab('DROPPED')}>
          <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">Dropped</p>
          <p className="text-3xl font-bold text-gray-600 mt-1">{stats?.dropped?.count ?? 0}</p>
          <p className="text-sm text-gray-500 mt-1">{fmt(stats?.dropped?.value ?? 0)}</p>
        </div>
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">Win Rate</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">{winRate}%</p>
          <p className="text-sm text-gray-500 mt-1">{totalWonCount + totalLostCount} total closed</p>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl border shadow-sm">

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-4 pt-3 gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors border-b-2 -mb-px ${
                tab === t.key
                  ? 'border-blue-600 text-blue-700 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-gray-100 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Name, company…"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Closed from</label>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Closed to</label>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
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
            <InboxIcon className="w-10 h-10 text-gray-400 mx-auto mb-3" aria-hidden="true" />
            <p className="text-gray-500 font-medium">No closed leads found</p>
            <p className="text-sm text-gray-400 mt-1">Closed leads appear here after a deal is closed from the CLOSURE stage</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Lead</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Company</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Outcome</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Value</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Closed By</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Closed On</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {leads.map(lead => {
                    const meta = STATUS_META[lead.status] ?? { label: lead.status, style: 'bg-gray-100 text-gray-600 border-gray-200' };
                    return (
                      <tr key={lead.id} onClick={() => router.push(`/leads/${lead.id}`)} className="hover:bg-blue-50 transition-colors cursor-pointer">
                        <td className="px-5 py-3.5 font-medium text-gray-900">{lead.name}</td>
                        <td className="px-4 py-3.5 text-gray-600">{lead.company}</td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full border font-medium ${meta.style}`}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-gray-800">
                          {lead.quoteValue ? fmt(Number(lead.quoteValue)) : <span className="text-gray-400 font-normal">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-gray-600">
                          {lead.assignedTo ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}` : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-gray-500">
                          {lead.closedAt ? fmtDate(lead.closedAt) : fmtDate(lead.updatedAt)}
                        </td>
                        <td className="px-4 py-3.5 text-gray-500 max-w-[200px]">
                          <span className="truncate block" title={lead.closureReason || ''}>
                            {lead.closureReason || <span className="text-gray-300">—</span>}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  {pagination.total} result{pagination.total !== 1 ? 's' : ''} · page {pagination.page} of {pagination.pages}
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
