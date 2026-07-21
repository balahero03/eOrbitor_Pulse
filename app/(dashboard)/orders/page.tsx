'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import LiveSearchDropdown, { highlightMatch } from '@/components/LiveSearchDropdown';

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
  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');

  useEffect(() => {
    fetchOrders();
  }, [page, status, paymentStatus]);

  const fetchOrders = async () => {
    setLoading(true);
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
    if (!confirm('Are you sure?')) return;

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
      case 'PENDING':   return 'bg-gray-100 text-gray-600 border-gray-200';
      case 'CONFIRMED': return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'FULFILLED': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'INVOICED':  return 'bg-violet-50 text-violet-700 border-violet-200';
      case 'COMPLETED': return 'bg-green-50 text-green-700 border-green-200';
      default:          return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  // Payment — money traffic-light: unpaid (red) → partial (amber) → paid (green).
  const getPaymentBadgeColor = (status: string) => {
    switch (status) {
      case 'PENDING':   return 'bg-red-50 text-red-700 border-red-200';
      case 'PARTIAL':   return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'COMPLETED': return 'bg-green-50 text-green-700 border-green-200';
      default:          return 'bg-gray-100 text-gray-600 border-gray-200';
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
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">Purchase orders from won leads</p>
        </div>
        <Link
          href="/orders/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
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

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
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
            />
          </div>

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Payments</option>
            <option value="PENDING">Unpaid</option>
            <option value="PARTIAL">Partial</option>
            <option value="COMPLETED">Paid</option>
          </select>

          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-500">Loading...</div>
        ) : orders.length === 0 ? (
          <div className="p-10 text-center text-gray-500">No orders found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide w-40">Order #</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Customer</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide w-28">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide w-28">Paid</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide w-28">Payment</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide w-28">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide w-28">PO Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3.5 font-mono text-sm font-medium text-gray-900">{order.orderNumber}</td>
                      <td className="px-4 py-3.5 text-sm text-gray-700 font-medium">{order.customer.companyName}</td>
                      <td className="px-4 py-3.5 text-sm font-semibold text-gray-900 text-right">{formatCurrency(order.totalAmount)}</td>
                      <td className="px-4 py-3.5 text-sm text-right">
                        <span className={parseFloat(order.amountPaid) > 0 ? 'text-green-700 font-semibold' : 'text-gray-400'}>
                          {parseFloat(order.amountPaid) > 0 ? formatCurrency(order.amountPaid) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium whitespace-nowrap ${getPaymentBadgeColor(order.paymentStatus)}`}>
                          {order.paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium whitespace-nowrap ${getStatusBadgeColor(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-500 whitespace-nowrap">
                        {order.poDate ? new Date(order.poDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-sm">
                        <div className="flex items-center gap-3">
                          <Link href={`/orders/${order.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                            View
                          </Link>
                          <button onClick={() => handleDelete(order.id)} className="text-red-500 hover:text-red-700 font-medium">
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
          </>
        )}
      </div>
    </div>
  );
}
