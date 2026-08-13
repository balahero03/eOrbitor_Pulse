'use client';

import { useState, useEffect, useCallback } from 'react';
import { toFiniteNumber } from '@/lib/money';
import Link from 'next/link';
import { QuotationIcon } from '@/components/icons';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import LiveSearchDropdown, { highlightMatch } from '@/components/LiveSearchDropdown';
import { useToast } from '@/components/Toast';
import PageContainer from '@/components/PageContainer';
import FilterPanel from '@/components/FilterPanel';
import { InlineLoader } from '@/components/BrandedLoader';

interface Quotation {
  id: string;
  quotationNumber: string;
  status: string;
  customer: { id: string; companyName: string };
  deal?: { dealName: string } | null;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  issueDate: string;
  expiryDate?: string;
  createdBy: { firstName: string; lastName: string; role: string };
  createdAt: string;
}

const STATUS_META: Record<string, { label: string; style: string }> = {
  DRAFT: { label: 'Draft', style: 'bg-gray-100 text-gray-700 border-gray-200' },
  SENT: { label: 'Sent', style: 'bg-blue-100 text-blue-700 border-blue-200' },
  ACCEPTED: { label: 'Accepted', style: 'bg-green-100 text-green-700 border-green-200' },
  REJECTED: { label: 'Rejected', style: 'bg-red-100 text-red-700 border-red-200' },
  EXPIRED: { label: 'Expired', style: 'bg-orange-100 text-orange-700 border-orange-200' },
};

const fmt = (v: string) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(toFiniteNumber(v));

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export default function QuotationsPage() {
  const toast = useToast();
  const { user: currentUser } = useCurrentUser();
  const isAdminUser = !!(currentUser && ['SUPER_ADMIN', 'ADMIN'].includes(currentUser.role));

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  // Admin-only master switch: when disabled, quotation-creation restrictions
  // (assigned-owner/manager only) are lifted for every user, on every lead.
  const [restrictionsDisabled, setRestrictionsDisabled] = useState(false);
  const [policyLoaded, setPolicyLoaded] = useState(false);
  const [togglingPolicy, setTogglingPolicy] = useState(false);

  const fetchPolicy = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/quotation-policy', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const d = await res.json();
      setRestrictionsDisabled(!!d.restrictionsDisabled);
    }
    setPolicyLoaded(true);
  };

  useEffect(() => { if (isAdminUser) fetchPolicy(); }, [isAdminUser]);

  const togglePolicy = async () => {
    setTogglingPolicy(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/quotation-policy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ restrictionsDisabled: !restrictionsDisabled }),
      });
      if (res.ok) {
        const d = await res.json();
        setRestrictionsDisabled(!!d.restrictionsDisabled);
      } else {
        toast.error('Failed to update the setting. Please try again.');
      }
    } catch {
      toast.error('Failed to update the setting. Please try again.');
    } finally {
      setTogglingPolicy(false);
    }
  };

  useEffect(() => { fetchQuotations(); }, [page, status]);

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(status && { status }),
        ...(search && { search }),
      });
      const res = await fetch(`/api/quotations?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setQuotations(data.quotations);
      setPagination(data.pagination);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchQuotations();
  };

  const fetchQuotationSuggestions = useCallback(async (query: string): Promise<Quotation[]> => {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({ search: query, page: '1', limit: '8' });
    const res = await fetch(`/api/quotations?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Search failed');
    const data = await res.json();
    return (data.quotations || []) as Quotation[];
  }, []);

  const renderQuotationSuggestion = (q: Quotation, query: string) => (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-900 truncate">{highlightMatch(q.quotationNumber, query)}</span>
        <span className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${STATUS_META[q.status]?.style || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
          {STATUS_META[q.status]?.label || q.status}
        </span>
      </div>
      <p className="text-xs text-gray-500 mt-0.5 truncate">
        {highlightMatch(q.customer?.companyName || '—', query)} · {fmt(q.totalAmount)}
      </p>
    </div>
  );

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Quotations</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">All customer quotations</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {isAdminUser && policyLoaded && (
            <button
              onClick={togglePolicy}
              disabled={togglingPolicy}
              title={restrictionsDisabled
                ? 'Currently OFF — any user can create a quotation for any lead. Click to restore normal permissions.'
                : 'Currently ON — only admins, managers, or a lead\'s assigned owner can create its quotation. Click to allow every user to create quotations for any lead.'}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium border transition-colors disabled:opacity-50 ${restrictionsDisabled
                  ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
            >
              <span className={`w-2 h-2 rounded-full ${restrictionsDisabled ? 'bg-amber-500' : 'bg-green-500'}`} />
              {togglingPolicy
                ? 'Updating…'
                : restrictionsDisabled
                  ? 'Restrictions: OFF'
                  : 'Restrictions: ON'}
            </button>
          )}
          <Link href="/quotations/new"
            className="px-3.5 sm:px-4 py-2 bg-blue-600 text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-blue-700 shadow-sm transition-colors whitespace-nowrap">
            + New Quotation
          </Link>
        </div>
      </div>

      {/* Filters */}
      <FilterPanel
        label="Search & Filters"
        activeCount={[search, status].filter(Boolean).length}
        onClear={() => { setSearch(''); setStatus(''); setPage(1); }}
      >
        <form onSubmit={handleSearch} className="max-w-full">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
            <div className="flex-1 min-w-0">
              <LiveSearchDropdown<Quotation>
                value={search}
                onChange={setSearch}
                onSearch={() => { setPage(1); fetchQuotations(); }}
                fetchSuggestions={fetchQuotationSuggestions}
                getKey={(q) => q.id}
                getHref={(q) => `/quotations/${q.id}`}
                renderItem={renderQuotationSuggestion}
                placeholder="Quotation number or company…"
                ariaLabel="Search quotations"
                cacheKeyPrefix="quotations"
                className="w-full"
              />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex-1 sm:w-40">
                <select
                  value={status}
                  onChange={e => { setStatus(e.target.value); setPage(1); }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">All Status</option>
                  <option value="DRAFT">Draft</option>
                  <option value="SENT">Sent</option>
                  <option value="ACCEPTED">Accepted</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="EXPIRED">Expired</option>
                </select>
              </div>
              <button type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-blue-700 shadow-sm transition-colors flex-shrink-0">
                Search
              </button>
            </div>
          </div>
        </form>
      </FilterPanel>

      {/* Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading ? (
          <InlineLoader />
        ) : quotations.length === 0 ? (
          <div className="text-center py-16">
            <QuotationIcon className="w-10 h-10 mx-auto mb-3" color="text-gray-300" />
            <p className="text-gray-500 font-medium">No quotations yet</p>
            <p className="text-sm text-gray-400 mt-1">
              <Link href="/quotations/new" className="text-blue-600 hover:underline">Create your first quotation →</Link>
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card List (< 640px) */}
            <div className="block sm:hidden divide-y divide-gray-200">
              {quotations.map(q => {
                const isPendingApproval = q.status === 'SENT' && !['SUPER_ADMIN', 'ADMIN'].includes(q.createdBy.role);
                const meta = isPendingApproval
                  ? { label: 'Pending Approval', style: 'bg-amber-100 text-amber-700 border-amber-200' }
                  : STATUS_META[q.status] ?? { label: q.status, style: 'bg-gray-100 text-gray-600 border-gray-200' };
                return (
                  <Link
                    key={q.id}
                    href={`/quotations/${q.id}`}
                    className="block p-4 active:bg-blue-50/70 transition-colors space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-bold text-gray-900 block">{q.quotationNumber}</span>
                        <p className="text-xs font-semibold text-gray-700 mt-0.5">{q.customer.companyName}</p>
                      </div>
                      <span className={`text-[11px] px-2.5 py-0.5 rounded-full border font-semibold flex-shrink-0 ${meta.style}`}>
                        {meta.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs pt-0.5">
                      <span className="text-sm font-bold text-gray-900">{fmt(q.totalAmount)}</span>
                      <span className="text-gray-400 text-[11px]">{fmtDate(q.issueDate)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Desktop / Tablet Table View (>= 640px) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Number</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Issued</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Created By</th>
                    <th className="px-4 py-3 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {quotations.map(q => {
                    const isPendingApproval = q.status === 'SENT' && !['SUPER_ADMIN', 'ADMIN'].includes(q.createdBy.role);
                    const meta = isPendingApproval
                      ? { label: 'Pending Approval', style: 'bg-amber-100 text-amber-700 border-amber-200' }
                      : STATUS_META[q.status] ?? { label: q.status, style: 'bg-gray-100 text-gray-600 border-gray-200' };
                    return (
                      <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-sm font-semibold text-gray-800">{q.quotationNumber}</td>
                        <td className="px-4 py-3.5 text-gray-700 font-medium">{q.customer.companyName}</td>
                        <td className="px-4 py-3.5 text-right font-semibold text-gray-900">{fmt(q.totalAmount)}</td>
                        <td className="px-4 py-3.5">
                          <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${meta.style}`}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-gray-500">{fmtDate(q.issueDate)}</td>
                        <td className="px-4 py-3.5 text-gray-500">
                          {q.createdBy.firstName} {q.createdBy.lastName}
                        </td>
                        <td className="px-4 py-3.5">
                          <Link href={`/quotations/${q.id}`}
                            className="text-xs text-blue-600 hover:underline font-medium">
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  {pagination.total} total · page {pagination.page} of {pagination.pages}
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
    </PageContainer>
  );
}
