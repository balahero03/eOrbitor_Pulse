'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Quotation {
  id: string;
  quotationNumber: string;
  status: string;
  customer: { id: string; companyName: string };
  deal: { dealName: string };
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  issueDate: string;
  expiryDate?: string;
  createdBy: { firstName: string; lastName: string };
  createdAt: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetchQuotations();
  }, [page, status]);

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

      if (!res.ok) throw new Error('Failed to fetch quotations');

      const data = await res.json();
      setQuotations(data.quotations);
      setPagination(data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchQuotations();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/quotations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setQuotations(quotations.filter(q => q.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'SENT': return 'bg-blue-100 text-blue-800';
      case 'ACCEPTED': return 'bg-green-100 text-green-800';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      case 'EXPIRED': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(parseFloat(value));
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Quotations</h1>
        <Link href="/quotations/new" className="btn btn-primary">+ New Quotation</Link>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6">
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <input
              type="text"
              placeholder="Search by quotation number or company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full"
            />
          </div>

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="w-full"
          >
            <option value="">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="SENT">Sent</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="REJECTED">Rejected</option>
            <option value="EXPIRED">Expired</option>
          </select>

          <button type="submit" className="btn btn-primary">
            Search
          </button>
        </form>
      </div>

      {/* Quotations Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-gray-600">Loading...</div>
        ) : quotations.length === 0 ? (
          <div className="p-6 text-center text-gray-600">No quotations found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Number</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Deal</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Issue Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {quotations.map((q) => (
                    <tr key={q.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium">{q.quotationNumber}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{q.customer.companyName}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{q.deal.dealName}</td>
                      <td className="px-6 py-4 font-medium">{formatCurrency(q.totalAmount)}</td>
                      <td className="px-6 py-4">
                        <span className={`badge px-2 py-1 rounded text-xs font-medium ${getStatusBadgeColor(q.status)}`}>
                          {q.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(q.issueDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex gap-2">
                          <Link
                            href={`/quotations/${q.id}`}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            View
                          </Link>
                          <button
                            onClick={() => handleDelete(q.id)}
                            className="text-red-600 hover:text-red-800 font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="p-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {(page - 1) * pagination.limit + 1} to{' '}
                  {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="btn btn-secondary disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2">{page} of {pagination.pages}</span>
                  <button
                    onClick={() => setPage(Math.min(pagination.pages, page + 1))}
                    disabled={page === pagination.pages}
                    className="btn btn-secondary disabled:opacity-50"
                  >
                    Next
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
