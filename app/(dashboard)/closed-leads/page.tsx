'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { InboxIcon } from '@heroicons/react/24/outline';
import PageContainer from '@/components/PageContainer';
import { buttonClasses } from '@/components/Button';

const TABS = [
  { key: '', label: 'All Closed' },
  { key: 'WON', label: 'Won → Orders' },
  { key: 'LOST', label: 'Lost' },
  { key: 'DROPPED', label: 'Dropped' },
];

const STATUS_META: Record<string, { label: string; style: string }> = {
  ORDER: { label: 'Won → Order', style: 'bg-green-100 text-green-800 border-green-200' },
  WON: { label: 'Won → Order', style: 'bg-green-100 text-green-800 border-green-200' },
  LOST: { label: 'Lost', style: 'bg-red-100 text-red-700 border-red-200' },
  DROPPED: { label: 'Dropped', style: 'bg-gray-100 text-gray-600 border-gray-200' },
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
    <PageContainer>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Closed Leads</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Won, Lost and Dropped opportunities</p>
        </div>
        <Link href="/leads" className={buttonClasses({ variant: 'secondary', className: 'w-full sm:w-auto' })}>
          ← Active Leads
        </Link>
      </div>

      {/* Stats row — 2×2 on a phone rather than four stacked full-width cards.
          At `p-5` with a `text-3xl` figure each card ran ~120px tall, so the
          four of them filled the entire first screen and the list they
          summarise started below the fold. Two-up with tighter type puts all
          four in about the height one used to take. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
        <button type="button" className="text-left bg-white rounded-xl border p-3 sm:p-5 shadow-sm cursor-pointer hover:border-green-300 transition-colors" onClick={() => setTab('WON')}>
          <p className="text-[10px] sm:text-xs text-gray-500 uppercase font-medium tracking-wide truncate">Won <span className="hidden xs:inline">(incl. Orders)</span></p>
          <p className="text-2xl sm:text-3xl font-bold text-green-600 mt-0.5 sm:mt-1 leading-none">{totalWonCount}</p>
          <p className="text-xs sm:text-sm text-green-700 font-medium mt-1 truncate">{fmt(totalWonValue)}</p>
        </button>
        <button type="button" className="text-left bg-white rounded-xl border p-3 sm:p-5 shadow-sm cursor-pointer hover:border-red-300 transition-colors" onClick={() => setTab('LOST')}>
          <p className="text-[10px] sm:text-xs text-gray-500 uppercase font-medium tracking-wide truncate">Lost</p>
          <p className="text-2xl sm:text-3xl font-bold text-red-600 mt-0.5 sm:mt-1 leading-none">{stats?.lost?.count ?? 0}</p>
          <p className="text-xs sm:text-sm text-red-700 font-medium mt-1 truncate">{fmt(stats?.lost?.value ?? 0)}</p>
        </button>
        <button type="button" className="text-left bg-white rounded-xl border p-3 sm:p-5 shadow-sm cursor-pointer hover:border-gray-400 transition-colors" onClick={() => setTab('DROPPED')}>
          <p className="text-[10px] sm:text-xs text-gray-500 uppercase font-medium tracking-wide truncate">Dropped</p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-600 mt-0.5 sm:mt-1 leading-none">{stats?.dropped?.count ?? 0}</p>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 truncate">{fmt(stats?.dropped?.value ?? 0)}</p>
        </button>
        <div className="bg-white rounded-xl border p-3 sm:p-5 shadow-sm">
          <p className="text-[10px] sm:text-xs text-gray-500 uppercase font-medium tracking-wide truncate">Win Rate</p>
          <p className="text-2xl sm:text-3xl font-bold text-blue-600 mt-0.5 sm:mt-1 leading-none">{winRate}%</p>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 truncate">{totalWonCount + totalLostCount} closed</p>
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
              className={`px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors border-b-2 -mb-px ${tab === t.key
                  ? 'border-blue-600 text-blue-700 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        {/* A grid rather than a wrapping flex row: the two date inputs keep
            their intrinsic width in flex, which on a narrow phone pushed them
            past the card edge and through the tablet range left them ragged. */}
        <div className="p-4 border-b border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
          <div className="col-span-2 sm:col-span-2 min-w-0">
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Name, company…"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div className="min-w-0">
            <label className="block text-xs font-medium text-gray-500 mb-1">Closed from</label>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="w-full min-w-0 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div className="min-w-0">
            <label className="block text-xs font-medium text-gray-500 mb-1">Closed to</label>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="w-full min-w-0 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          {(search || from || to) && (
            <button
              onClick={() => { setSearch(''); setFrom(''); setTo(''); }}
              className="col-span-2 sm:col-span-4 sm:justify-self-start px-3 py-2 text-sm text-gray-500 border rounded-lg hover:bg-gray-50"
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
            {/* Mobile Card List (< 640px) */}
            <div className="block lg:hidden divide-y divide-gray-200">
              {leads.map(lead => {
                const meta = STATUS_META[lead.status] ?? { label: lead.status, style: 'bg-gray-100 text-gray-600 border-gray-200' };
                return (
                  <div
                    key={lead.id}
                    onClick={() => router.push(`/leads/${lead.id}`)}
                    className="p-4 active:bg-blue-50/70 transition-colors cursor-pointer space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-gray-900 text-sm">{lead.name}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{lead.company}</p>
                      </div>
                      <span className={`inline-flex items-center text-[11px] px-2.5 py-0.5 rounded-full border font-semibold flex-shrink-0 ${meta.style}`}>
                        {meta.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs pt-0.5">
                      <div>
                        <span className="text-xs text-gray-400">Value: </span>
                        <span className="font-bold text-gray-900">{lead.quoteValue ? fmt(Number(lead.quoteValue)) : '—'}</span>
                      </div>
                      <div className="text-gray-500 text-[11px]">
                        Closed {lead.closedAt ? fmtDate(lead.closedAt) : fmtDate(lead.updatedAt)}
                      </div>
                    </div>

                    {lead.closureReason && (
                      <div className="text-[11px] text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-100">
                        <span className="font-medium text-gray-600">Reason: </span>
                        {lead.closureReason}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop / Tablet Table View (>= 640px) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
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
    </PageContainer>
  );
}
