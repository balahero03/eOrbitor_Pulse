'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { QuotationIcon } from '@/components/icons';

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
  DRAFT:    { label: 'Draft',    style: 'bg-gray-100 text-gray-700 border-gray-200' },
  SENT:     { label: 'Sent',     style: 'bg-blue-100 text-blue-700 border-blue-200' },
  ACCEPTED: { label: 'Accepted', style: 'bg-green-100 text-green-700 border-green-200' },
  REJECTED: { label: 'Rejected', style: 'bg-red-100 text-red-700 border-red-200' },
  EXPIRED:  { label: 'Expired',  style: 'bg-orange-100 text-orange-700 border-orange-200' },
};

const fmt = (v: string) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(parseFloat(v));

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

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

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotations</h1>
          <p className="text-sm text-gray-500">All customer quotations</p>
        </div>
        <Link href="/quotations/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-sm">
          + New Quotation
        </Link>
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} className="bg-white rounded-xl border shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
          <input
            type="text"
            placeholder="Quotation number or company…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
          <select
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
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
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          Search
        </button>
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : quotations.length === 0 ? (
          <div className="text-center py-16">
            <QuotationIcon className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">No quotations yet</p>
            <p className="text-sm text-gray-400 mt-1">
              <Link href="/quotations/new" className="text-blue-600 hover:underline">Create your first quotation →</Link>
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
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
                    // A non-admin's SENT quote is really awaiting a manager/admin's
                    // sign-off, not actually dispatched to the customer yet.
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
    </div>
  );
}
