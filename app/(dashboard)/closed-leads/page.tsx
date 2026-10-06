'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDelayedFlag } from '@/lib/hooks/useDelayedFlag';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { InboxIcon } from '@heroicons/react/24/outline';
import LiveSearchDropdown, { highlightMatch } from '@/components/LiveSearchDropdown';
import PageContainer from '@/components/PageContainer';
import { buttonClasses } from '@/components/Button';
import { InlineLoader } from '@/components/BrandedLoader';

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
  // `loading` gates only the first paint; `refreshing` covers every later
  // fetch so a tab/search/date filter change dims the current rows instead
  // of replacing them with a spinner.
  const [refreshing, setRefreshing] = useState(false);
  // Only actually dims the list once the fetch has been running for 150ms —
  // see lib/hooks/useDelayedFlag.ts. Without this, a fast API response
  // reverses the opacity transition before it ever finishes animating, which
  // reads as a one-frame flicker rather than a fade.
  const showRefreshing = useDelayedFlag(refreshing);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);

  const fetchClosedLeadSuggestions = useCallback(async (query: string): Promise<any[]> => {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({ search: query, page: '1', limit: '8' });
    const res = await fetch(`/api/leads/closed?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Search failed');
    const data = await res.json();
    return (data.leads || []);
  }, []);

  const renderClosedLeadSuggestion = (lead: any, query: string) => {
    const ownerName = lead.assignedTo ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName || ''}`.trim() : '';
    return (
      <div className="min-w-0">
        <div className="flex items-center gap-2 justify-between">
          <span className="text-sm font-semibold text-gray-900 truncate">{highlightMatch(lead.name, query)}</span>
          <span className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${STATUS_META[lead.status]?.style || 'bg-gray-100 text-gray-700'}`}>
            {STATUS_META[lead.status]?.label || lead.status}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5 truncate">
          {highlightMatch(lead.company, query)}
          {(lead.leadNumber || lead.quoteNo) ? ` · ${lead.leadNumber || lead.quoteNo}` : ''}
          {ownerName ? <> · Owner: {highlightMatch(ownerName, query)}</> : ''}
        </p>
      </div>
    );
  };

  useEffect(() => { setPage(1); }, [tab, search, from, to]);

  useEffect(() => { fetchLeads(); }, [tab, search, from, to, page]);

  const fetchLeads = async () => {
    setRefreshing(true);
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
      setRefreshing(false);
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

      {/* Search bar + filter toggle (Leads-style) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3.5 sm:p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-stretch sm:items-center">
          <LiveSearchDropdown<any>
            value={search}
            onChange={setSearch}
            onSearch={() => setPage(1)}
            fetchSuggestions={fetchClosedLeadSuggestions}
            getKey={(l) => l.id}
            getHref={(l) => `/leads/${l.id}`}
            renderItem={renderClosedLeadSuggestion}
            placeholder="Search by name, company, quote number, assigned user..."
            ariaLabel="Search closed leads"
            cacheKeyPrefix="closed-leads"
            className="w-full sm:flex-1 min-w-0"
          />
          <div className="flex items-center gap-2 flex-shrink-0 justify-end">
            <button
              type="button"
              onClick={() => setShowFilters(f => !f)}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs sm:text-sm font-semibold transition-colors ${showFilters || Boolean(from || to)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
              </svg>
              Filters
              {[from, to].filter(Boolean).length > 0 && (
                <span className="bg-white text-blue-600 rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold ml-0.5">
                  {[from, to].filter(Boolean).length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setPage(1)}
              className="flex-1 sm:flex-initial px-4 py-2 bg-blue-600 text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm text-center"
            >
              Search
            </button>
            {(search || from || to) && (
              <button
                type="button"
                onClick={() => { setSearch(''); setFrom(''); setTo(''); setPage(1); }}
                className="text-xs text-gray-500 hover:text-red-600 underline px-1"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Expanded filter panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Closed From</label>
              <input
                type="date"
                value={from}
                onChange={e => { setFrom(e.target.value); setPage(1); }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Closed To</label>
              <input
                type="date"
                value={to}
                onChange={e => { setTo(e.target.value); setPage(1); }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl border shadow-sm">

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-4 pt-3 gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`tab-button px-4 py-2.5 text-sm font-semibold rounded-t-lg whitespace-nowrap transition-all duration-200 ease-out border-b-2 -mb-px ${tab === t.key
                ? 'border-blue-600 text-blue-700 bg-blue-50/80 shadow-xs'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50/70'
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <InlineLoader />
        ) : leads.length === 0 ? (
          <div className="text-center py-16">
            <InboxIcon className="w-10 h-10 text-gray-400 mx-auto mb-3" aria-hidden="true" />
            <p className="text-gray-500 font-medium">No closed leads found</p>
            <p className="text-sm text-gray-400 mt-1">Closed leads appear here after a deal is closed from the CLOSURE stage</p>
          </div>
        ) : (
          <div className={`transition-opacity duration-200 ${showRefreshing ? 'opacity-40' : 'opacity-100'}`}>
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
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {(lead.leadNumber || lead.quoteNo) && (
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-semibold">
                              {lead.leadNumber || lead.quoteNo}
                            </span>
                          )}
                          <h3 className="font-bold text-gray-900 text-sm">{lead.name}</h3>
                        </div>
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
              <table className="w-full text-sm min-w-[960px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">Lead #</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Lead</th>
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
                        <td className="px-4 py-3.5 font-mono text-xs text-gray-600 font-medium">
                          {lead.leadNumber || lead.quoteNo ? (
                            <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-mono text-xs">
                              {lead.leadNumber || lead.quoteNo}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-gray-900">{lead.name}</td>
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
          </div>
        )}
      </div>
    </PageContainer>
  );
}
