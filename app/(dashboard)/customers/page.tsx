'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import LiveSearchDropdown, { highlightMatch } from '@/components/LiveSearchDropdown';

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
  source: 'lead' | 'manual';
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

  // Mirrors fetchCustomers' own won-lead + manual-customer merge, but scoped
  // to a small `limit` for the live dropdown rather than the full page list.
  const fetchCustomerSuggestions = useCallback(async (query: string): Promise<Customer[]> => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    const params = new URLSearchParams({ search: query, page: '1', limit: '6' });

    const [wonRes, custRes] = await Promise.all([
      fetch(`/api/leads/won?${params}`, { headers }),
      fetch(`/api/customers?${params}`, { headers }),
    ]);

    const wonData = wonRes.ok ? await wonRes.json() : { customers: [] };
    const wonList: Customer[] = (wonData.customers || []).map((c: any) => ({ ...c, source: 'lead' as const }));

    let manualList: Customer[] = [];
    if (custRes.ok) {
      const custData = await custRes.json();
      const linkedIds = new Set((wonData.customers || []).map((c: any) => c.linkedCustomerId).filter(Boolean));
      manualList = (custData.customers || [])
        .filter((c: any) => !linkedIds.has(c.id))
        .map((c: any) => {
          const primary = c.contacts?.[0];
          return {
            id: c.id,
            name: primary?.name || '—',
            company: c.companyName,
            email: primary?.email || '—',
            phone: primary?.phone || undefined,
            source: 'manual' as const,
          };
        });
    }

    return [...manualList, ...wonList].slice(0, 8);
  }, []);

  const renderCustomerSuggestion = (c: Customer, query: string) => (
    <div className="min-w-0">
      <p className="text-sm font-semibold text-gray-900 truncate">{highlightMatch(c.name, query)}</p>
      <p className="text-xs text-gray-500 mt-0.5 truncate">
        {highlightMatch(c.company, query)} · {highlightMatch(c.email, query)}
      </p>
    </div>
  );

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(search && { search }),
      });

      // Won leads (auto-converted) + manually added customers.
      const [wonRes, custRes] = await Promise.all([
        fetch(`/api/leads/won?${params}`, { headers }),
        fetch(`/api/customers?${params}`, { headers }),
      ]);

      if (!wonRes.ok) throw new Error('Failed to fetch customers');

      const wonData = await wonRes.json();
      const wonList: Customer[] = (wonData.customers || []).map((c: any) => ({
        ...c,
        source: 'lead' as const,
      }));

      let manualList: Customer[] = [];
      if (custRes.ok) {
        const custData = await custRes.json();
        // Avoid duplicating customers that are already linked to a won lead.
        const linkedIds = new Set(
          (wonData.customers || [])
            .map((c: any) => c.linkedCustomerId)
            .filter(Boolean)
        );
        manualList = (custData.customers || [])
          .filter((c: any) => !linkedIds.has(c.id))
          .map((c: any) => {
            const primary = c.contacts?.[0];
            return {
              id: c.id,
              name: primary?.name || '—',
              company: c.companyName,
              email: primary?.email || '—',
              phone: primary?.phone || undefined,
              address: c.billingAddress?.street || undefined,
              gstNumber: c.gstNumber,
              quoteValue: undefined,
              closedAt: c.createdAt,
              source: 'manual' as const,
            };
          });
      }

      setCustomers([...manualList, ...wonList]);
      setPagination(wonData.pagination);
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
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500">Won leads converted to customers</p>
        </div>
        <div className="flex gap-2">
          <Link href="/leads/new" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
            ← Back to Leads
          </Link>
          <Link href="/customers/new" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            + Add Existing Customer
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <LiveSearchDropdown<Customer>
          value={search}
          onChange={setSearch}
          onSearch={() => setPage(1)}
          fetchSuggestions={fetchCustomerSuggestions}
          getKey={(c) => c.id}
          getHref={(c) => `/customers/${c.id}`}
          renderItem={renderCustomerSuggestion}
          placeholder="Search by customer name, company, or email..."
          ariaLabel="Search customers"
          cacheKeyPrefix="customers"
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
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Source</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Added / Won Date</th>
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
                      <td className="px-6 py-3 text-sm">
                        {customer.source === 'manual' ? (
                          <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium">Existing</span>
                        ) : (
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">Won Lead</span>
                        )}
                      </td>
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
