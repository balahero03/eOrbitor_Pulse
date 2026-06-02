'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Customer {
  id: string;
  name: string;
  company: string;
  email: string;
  phone?: string;
  address?: string;
  gstNumber?: string;
  quoteValue?: number;
  closedAt?: string;
  linkedCustomerId?: string;
}

const fmt = (v: number | undefined) =>
  v ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v) : '—';

const fmtDate = (d: string | undefined) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState<any>(null);
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [search]);
  useEffect(() => { fetchCustomers(); }, [page, search]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(search && { search }),
      });

      const res = await fetch(`/api/leads/won?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch customers');

      const data = await res.json();
      setCustomers(data.customers || []);
      setPagination(data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500">Won leads converted to customers</p>
        </div>
        <div className="flex gap-2">
          <Link href="/leads/new" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
            ← Back to Leads
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <input
          type="text"
          placeholder="Search by customer name, company, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading customers...</div>
        ) : customers.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No customers found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Contact Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Company</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">GST Number</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Address</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700">Won Value</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Won Date</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {customers.map(customer => (
                    <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 font-medium text-gray-900">{customer.name}</td>
                      <td className="px-6 py-3 text-gray-600">{customer.company}</td>
                      <td className="px-6 py-3 text-gray-600 text-sm">{customer.email}</td>
                      <td className="px-6 py-3 text-gray-600 text-sm">{customer.phone || '—'}</td>
                      <td className="px-6 py-3 text-gray-600 text-sm">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                          {customer.gstNumber || 'Not provided'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-600 text-sm">{customer.address || '—'}</td>
                      <td className="px-6 py-3 text-right font-semibold text-gray-800">{fmt(customer.quoteValue)}</td>
                      <td className="px-6 py-3 text-gray-600 text-sm">{fmtDate(customer.closedAt)}</td>
                      <td className="px-6 py-3">
                        <div className="flex gap-2">
                          <Link
                            href={`/customers/${customer.id}`}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
                          >
                            View Customer
                          </Link>
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
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= pagination.pages}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40"
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
