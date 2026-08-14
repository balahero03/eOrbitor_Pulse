'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDelayedFlag } from '@/lib/hooks/useDelayedFlag';
import { toFiniteNumber } from '@/lib/money';
import Link from 'next/link';
import LiveSearchDropdown, { highlightMatch } from '@/components/LiveSearchDropdown';
import { useConfirm } from '@/components/ConfirmDialog';
import PageContainer from '@/components/PageContainer';
import { buttonClasses } from '@/components/Button';
import FilterPanel from '@/components/FilterPanel';
import { InlineLoader } from '@/components/BrandedLoader';

interface Order {
  id: string;
  orderNumber: string;
  poNumber?: string;
  status: string;
  paymentStatus: string;
  customer: { id: string; companyName: string };
  quotation?: { quotationNumber: string };
  totalAmount: string;
  amountPaid: string;
  poDate?: string;
  deliveryDate?: string;
  createdAt: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function OrdersPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  // `loading` gates only the first paint; `refreshing` covers every later
  // fetch so a status/payment filter change dims the current rows instead of
  // replacing them with a spinner.
  const [refreshing, setRefreshing] = useState(false);
  // Only actually dims the list once the fetch has been running for 150ms —
  // see lib/hooks/useDelayedFlag.ts. Without this, a fast API response
  // reverses the opacity transition before it ever finishes animating, which
  // reads as a one-frame flicker rather than a fade.
  const showRefreshing = useDelayedFlag(refreshing);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');

  useEffect(() => {
    fetchOrders();
  }, [page, status, paymentStatus]);

  const fetchOrders = async () => {
    setRefreshing(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(status && { status }),
        ...(paymentStatus && { paymentStatus }),
        ...(search && { search }),
      });

      const res = await fetch(`/api/orders?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch orders');

      const data = await res.json();
      setOrders(data.orders);
      setPagination(data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOrders();
  };

  const fetchOrderSuggestions = useCallback(async (query: string): Promise<Order[]> => {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({ search: query, page: '1', limit: '8' });
    const res = await fetch(`/api/orders?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Search failed');
    const data = await res.json();
    return (data.orders || []) as Order[];
  }, []);

  const renderOrderSuggestion = (order: Order, query: string) => (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-900 truncate">{highlightMatch(order.orderNumber, query)}</span>
        <span className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${getStatusBadgeColor(order.status)}`}>
          {order.status}
        </span>
      </div>
      <p className="text-xs text-gray-500 mt-0.5 truncate">
        {highlightMatch(order.customer?.companyName || '—', query)} · {formatCurrency(order.totalAmount)}
      </p>
    </div>
  );

  const handleDelete = async (id: string) => {
    if (!(await confirm('This order will be permanently deleted. This cannot be undone.', { title: 'Delete order?', danger: true }))) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/orders/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setOrders(orders.filter(o => o.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Order lifecycle — a calm cool-toned progression, green reserved for the
  // final Completed state. Muted (-50/-200) so the table doesn't read as loud.
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-gray-100 text-gray-600 border-gray-200';
      case 'CONFIRMED': return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'FULFILLED': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'INVOICED': return 'bg-violet-50 text-violet-700 border-violet-200';
      case 'COMPLETED': return 'bg-green-50 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  // Payment — money traffic-light: unpaid (red) → partial (amber) → paid (green).
  const getPaymentBadgeColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-red-50 text-red-700 border-red-200';
      case 'PARTIAL': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'COMPLETED': return 'bg-green-50 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(toFiniteNumber(value));
  };

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Purchase orders from won leads</p>
        </div>
        <Link
          href="/orders/new"
          className={buttonClasses({ className: 'w-full sm:w-auto' })}
        >
          + New Order
        </Link>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-6">
        <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-blue-700">
          Orders are created when a lead is marked <span className="font-semibold">Won</span> in the pipeline.
          View your{' '}
          <Link href="/closed-leads" className="underline font-medium hover:text-blue-900">
            closed leads
          </Link>{' '}
          to see WON leads ready for order creation.
        </p>
      </div>

      {/* Quick Status Filter Pills */}
      <div className="flex gap-2 overflow-x-auto pt-2 pb-2 px-1 -mx-1 whitespace-nowrap mb-4 scrollbar-none max-w-full">
        {[
          { value: '', label: 'All Orders' },
          { value: 'PENDING', label: 'Pending' },
          { value: 'CONFIRMED', label: 'Confirmed' },
          { value: 'FULFILLED', label: 'Fulfilled' },
          { value: 'INVOICED', label: 'Invoiced' },
          { value: 'COMPLETED', label: 'Completed' },
        ].map(s => (
          <button
            key={s.value}
            onClick={() => {
              const next = status === s.value ? '' : s.value;
              setStatus(next);
              setPage(1);
            }}
            className={`filter-pill px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 ease-out ${status === s.value
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm scale-[1.02] ring-2 ring-blue-400/40'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50/80 hover:text-gray-900'
              }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <FilterPanel
        label="Search & Filters"
        activeCount={[search, status, paymentStatus].filter(Boolean).length}
        onClear={() => { setSearch(''); setStatus(''); setPaymentStatus(''); setPage(1); }}
      >
        <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-center">
          <div className="w-full">
            <LiveSearchDropdown<Order>
              value={search}
              onChange={setSearch}
              onSearch={() => { setPage(1); fetchOrders(); }}
              fetchSuggestions={fetchOrderSuggestions}
              getKey={(o) => o.id}
              getHref={(o) => `/orders/${o.id}`}
              renderItem={renderOrderSuggestion}
              placeholder="Search by order number..."
              ariaLabel="Search orders"
              cacheKeyPrefix="orders"
              className="w-full"
            />
          </div>

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="FULFILLED">Fulfilled</option>
            <option value="INVOICED">Invoiced</option>
            <option value="COMPLETED">Completed</option>
          </select>

          <select
            value={paymentStatus}
            onChange={(e) => {
              setPaymentStatus(e.target.value);
              setPage(1);
            }}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All Payments</option>
            <option value="PENDING">Unpaid</option>
            <option value="PARTIAL">Partial</option>
            <option value="COMPLETED">Paid</option>
          </select>

          <button
            type="submit"
            className={buttonClasses({ className: 'w-full sm:w-auto' })}
          >
            Search
          </button>
        </form>
      </FilterPanel>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <InlineLoader message="Loading orders…" />
        ) : orders.length === 0 ? (
          <div className="p-10 text-center text-gray-500">No orders found</div>
        ) : (
          <div className={`transition-opacity duration-200 ${showRefreshing ? 'opacity-40' : 'opacity-100'}`}>
            {/* Mobile Card List (< 640px)
                Two fixes to how records read as separate things. The row
                divider was `gray-100` while each row drew its *own* `gray-50`
                rule between its two halves — near-identical weights, so a
                single order looked like two records. The inner rule is gone and
                the divider between records is now `gray-200`, which is the only
                horizontal line in the list. */}
            <div className="block sm:hidden divide-y divide-gray-200">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="block px-4 py-3.5 active:bg-blue-50/70 transition-colors cursor-pointer space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-mono text-xs font-bold text-gray-900 block truncate">{order.orderNumber}</span>
                      <p className="text-xs font-semibold text-gray-700 mt-0.5 truncate">{order.customer.companyName}</p>
                    </div>
                    <span className={`text-[11px] px-2.5 py-0.5 rounded-full border font-semibold flex-shrink-0 whitespace-nowrap ${getStatusBadgeColor(order.status)}`}>
                      {order.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <span className="text-sm font-bold text-gray-900">{formatCurrency(order.totalAmount)}</span>
                      {parseFloat(order.amountPaid) > 0 && (
                        <span className="text-[11px] text-green-700 font-semibold block truncate">
                          Paid: {formatCurrency(order.amountPaid)}
                        </span>
                      )}
                    </div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium flex-shrink-0 whitespace-nowrap ${getPaymentBadgeColor(order.paymentStatus)}`}>
                      {order.paymentStatus}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop / Tablet Table View (>= 640px) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide w-40">Order #</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Customer</th>
                    {/* The old Total | Paid | Payment trio said the same thing
                        three times: the badge was just Paid-vs-Total restated as
                        a word, and its PENDING/COMPLETED collided with the
                        fulfilment Status beside it. One money column now carries
                        the figures and how far along they are. */}
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide w-44">Payment</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide w-28">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide w-28">PO Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => router.push(`/orders/${order.id}`)}
                      className="cursor-pointer table-row-interactive transition-all duration-150 ease-in-out hover:bg-blue-50/40"
                    >
                      <td className="px-4 py-3.5 font-mono text-sm font-medium text-gray-900">{order.orderNumber}</td>
                      <td className="px-4 py-3.5 text-sm text-gray-700 font-semibold">{order.customer.companyName}</td>
                      <td className="px-4 py-3.5 text-right">
                        {(() => {
                          const t = parseFloat(order.totalAmount) || 0;
                          const pd = parseFloat(order.amountPaid) || 0;
                          const pct = t > 0 ? Math.min(100, Math.round((pd / t) * 100)) : 0;
                          const done = t > 0 && pd >= t;
                          return (
                            <div className="inline-block w-full max-w-[150px]">
                              <div className="flex items-baseline justify-end gap-1.5 tabular-nums">
                                <span className={`text-sm font-semibold ${done ? 'text-green-700' : pd > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                                  {pd > 0 ? formatCurrency(order.amountPaid) : '—'}
                                </span>
                                <span className="text-xs text-gray-400">/ {formatCurrency(order.totalAmount)}</span>
                              </div>
                              {/* The bar is the payment status: empty, part-full,
                                  or complete — read at a glance, no word needed. */}
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1.5">
                                <div className={`h-full rounded-full transition-all ${done ? 'bg-green-500' : pd > 0 ? 'bg-amber-400' : 'bg-gray-200'}`}
                                  style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium whitespace-nowrap ${getStatusBadgeColor(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-500 whitespace-nowrap">
                        {order.poDate ? new Date(order.poDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(order.id); }}
                          className="text-xs font-semibold text-red-600 hover:text-red-800 hover:bg-red-50 px-2.5 py-1 rounded-md transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="p-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-600">
                <span>
                  Showing {(page - 1) * pagination.limit + 1}–{Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1">{page} of {pagination.pages}</span>
                  <button
                    onClick={() => setPage(Math.min(pagination.pages, page + 1))}
                    disabled={page === pagination.pages}
                    className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
