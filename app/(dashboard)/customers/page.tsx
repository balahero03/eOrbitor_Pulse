'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import LiveSearchDropdown, { highlightMatch } from '@/components/LiveSearchDropdown';
import PageContainer from '@/components/PageContainer';
import { PhoneGlyph, MailGlyph } from '@/components/icons';
import { buttonClasses } from '@/components/Button';

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
  customerCategory?: string;
  source: 'lead' | 'manual';
}

const CATEGORY_STYLE: Record<string, string> = {
  PROSPECT: 'bg-blue-50 text-blue-700 border-blue-200',
  ACTIVE: 'bg-green-50 text-green-700 border-green-200',
  INACTIVE: 'bg-gray-100 text-gray-600 border-gray-200',
  LOST: 'bg-red-50 text-red-700 border-red-200',
};

const fmt = (v: number | undefined) =>
  v ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v) : '—';

const fmtDate = (d: string | undefined) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  // See leads/page.tsx — same keep-previous-data treatment: `loading` gates
  // only the first paint, `refreshing` covers every later fetch so the list
  // dims instead of disappearing when the page or search changes.
  const [refreshing, setRefreshing] = useState(false);
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
    setRefreshing(true);
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
              customerCategory: c.customerCategory,
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
      setRefreshing(false);
    }
  };

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Won leads converted to customers</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/leads/new" className={buttonClasses({ variant: 'secondary', className: 'flex-1 sm:flex-none' })}>
            ← Back to Leads
          </Link>
          <Link href="/customers/new" className={buttonClasses({ className: 'flex-1 sm:flex-none' })}>
            + Add Existing Customer
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 max-w-full overflow-hidden">
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
          <div className={`transition-opacity duration-200 ${refreshing ? 'opacity-40' : 'opacity-100'}`}>
            {/* Mobile Card List (< 640px) */}
            <div className="block sm:hidden divide-y divide-gray-200">
              {customers.map((customer) => (
                <Link
                  key={customer.id}
                  href={`/customers/${customer.id}`}
                  className="block p-4 active:bg-blue-50/70 transition-colors space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">{customer.company}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Contact: {customer.name}</p>
                    </div>
                    {customer.source === 'manual' ? (
                      <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-[11px] font-semibold border border-purple-200">Existing</span>
                    ) : (
                      <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-[11px] font-semibold border border-green-200">Won Lead</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs pt-0.5">
                    <span className="font-bold text-gray-900 text-sm">{fmt(customer.quoteValue)}</span>
                    <span className="text-gray-400 text-[11px]">{fmtDate(customer.closedAt)}</span>
                  </div>

                  {(customer.phone || customer.email) && (
                    <div className="text-[11px] text-gray-500 flex flex-wrap gap-2 pt-0.5">
                      {customer.phone && (
                        <span className="inline-flex items-center gap-1">
                          <PhoneGlyph className="w-3 h-3" color="text-gray-400" />{customer.phone}
                        </span>
                      )}
                      {customer.email && (
                        <span className="inline-flex items-center gap-1 truncate min-w-0">
                          <MailGlyph className="w-3 h-3 flex-shrink-0" color="text-gray-400" />
                          <span className="truncate">{customer.email}</span>
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              ))}
            </div>

            {/* Desktop / Tablet Table View (>= 640px) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {/* Company leads, because it is what these records are keyed
                        on and what you search by. GST, address, won value and
                        source moved to the detail page — they were columns of
                        mostly-empty cells and placeholder GST strings. */}
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Company</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {customers.map(customer => (
                    <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 font-medium text-gray-900">{customer.company}</td>
                      <td className="px-6 py-3 text-gray-600 text-sm">{customer.name && customer.name !== '—' ? customer.name : <span className="text-gray-300">—</span>}</td>
                      <td className="px-6 py-3 text-gray-600 text-sm whitespace-nowrap">{customer.phone || <span className="text-gray-300">—</span>}</td>
                      <td className="px-6 py-3 text-gray-600 text-sm">{customer.email && customer.email !== '—' ? customer.email : <span className="text-gray-300">—</span>}</td>
                      <td className="px-6 py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${CATEGORY_STYLE[customer.customerCategory || (customer.source === 'lead' ? 'ACTIVE' : 'PROSPECT')] || CATEGORY_STYLE.PROSPECT}`}>
                          {customer.customerCategory || (customer.source === 'lead' ? 'ACTIVE' : 'PROSPECT')}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <Link href={`/customers/${customer.id}`}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline whitespace-nowrap">
                          View →
                        </Link>
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
className={buttonClasses({ variant: 'secondary' })}
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= pagination.pages}
className={buttonClasses({ variant: 'secondary' })}
                  >
                    Next
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
