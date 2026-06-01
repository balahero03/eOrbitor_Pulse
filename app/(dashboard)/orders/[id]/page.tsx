'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Order {
  id: string;
  orderNumber: string;
  poNumber?: string;
  status: string;
  paymentStatus: string;
  customer: { id: string; companyName: string };
  quotation?: { id: string; quotationNumber: string };
  deal?: { id: string; dealName: string };
  totalAmount: string;
  amountPaid: string;
  poDate?: string;
  deliveryDate?: string;
  createdAt: string;
}

export default function OrderDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/orders/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch order');

      const data = await res.json();
      setOrder(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setUpdating(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/orders/${id}/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to confirm order');

      const updated = await res.json();
      setOrder(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  const handleFulfill = async () => {
    setUpdating(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/orders/${id}/fulfill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ deliveryDate: new Date().toISOString() }),
      });

      if (!res.ok) throw new Error('Failed to fulfill order');

      const updated = await res.json();
      setOrder(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  const handleAddPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    setUpdating(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/orders/${id}/payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amountPaid: parseFloat(paymentAmount) }),
      });

      if (!res.ok) throw new Error('Failed to add payment');

      const updated = await res.json();
      setOrder(updated);
      setPaymentAmount('');
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure?')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/orders/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        router.push('/orders');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'PENDING':   return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'CONFIRMED': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'FULFILLED': return 'bg-green-100 text-green-800 border-green-300';
      case 'INVOICED':  return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'COMPLETED': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      default:          return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getPaymentBadgeColor = (status: string) => {
    switch (status) {
      case 'PENDING':   return 'bg-red-100 text-red-800 border-red-300';
      case 'PARTIAL':   return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'COMPLETED': return 'bg-green-100 text-green-800 border-green-300';
      default:          return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(parseFloat(value));
  };

  const getPaymentProgress = () => {
    const total = parseFloat(order?.totalAmount || '0');
    const paid = parseFloat(order?.amountPaid || '0');
    return (paid / total) * 100;
  };

  if (loading) return (
    <div className="p-6 text-center text-gray-500">Loading...</div>
  );
  if (!order) return (
    <div className="p-6 text-center text-gray-500">Order not found</div>
  );

  const remainingAmount = parseFloat(order.totalAmount) - parseFloat(order.amountPaid);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{order.orderNumber}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{order.customer.companyName}</p>
        </div>
        <Link
          href="/orders"
          className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          ← Back to Orders
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-4">
          {/* Header Info */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">Customer</p>
                <p className="text-lg font-semibold text-gray-900">{order.customer.companyName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">Order Status</p>
                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${getStatusBadgeColor(order.status)}`}>
                  {order.status}
                </span>
              </div>
              {order.quotation && (
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">Quotation</p>
                  <p className="text-lg font-semibold text-gray-900">{order.quotation.quotationNumber}</p>
                </div>
              )}
              {order.deal && (
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">Deal</p>
                  <p className="text-lg font-semibold text-gray-900">{order.deal.dealName}</p>
                </div>
              )}
            </div>
          </div>

          {/* PO Details */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-bold text-gray-900 mb-4">PO Details</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">PO Number</p>
                <p className="text-base font-medium text-gray-900">{order.poNumber || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">PO Date</p>
                <p className="text-base font-medium text-gray-900">
                  {order.poDate ? new Date(order.poDate).toLocaleDateString('en-IN') : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Order Amount */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-bold text-gray-900 mb-4">Order Amount</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Order Total:</span>
                <span className="font-semibold text-gray-900">{formatCurrency(order.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Amount Paid:</span>
                <span className="font-semibold text-green-700">{formatCurrency(order.amountPaid)}</span>
              </div>
              <div className="border-t border-gray-100 pt-3 flex justify-between font-bold">
                <span className="text-gray-900">Outstanding:</span>
                <span className={remainingAmount > 0 ? 'text-red-600' : 'text-green-600'}>
                  {formatCurrency(remainingAmount.toString())}
                </span>
              </div>

              {/* Payment Progress */}
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all"
                    style={{ width: `${Math.min(getPaymentProgress(), 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {getPaymentProgress().toFixed(0)}% paid
                </p>
              </div>
            </div>
          </div>

          {/* Payment Input */}
          {order.paymentStatus !== 'COMPLETED' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-base font-bold text-gray-900 mb-4">Add Payment</h2>
              <div className="flex gap-3">
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Amount to pay"
                  step="0.01"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={handleAddPayment}
                  disabled={updating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {updating ? 'Processing...' : 'Add Payment'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Payment Status */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Payment Status</h3>
            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${getPaymentBadgeColor(order.paymentStatus)}`}>
              {order.paymentStatus}
            </span>
            <div className="mt-4 text-sm space-y-2 text-gray-600">
              <div className="flex justify-between">
                <span>Due:</span>
                <span className="font-semibold text-gray-900">{formatCurrency(remainingAmount.toString())}</span>
              </div>
              <div className="flex justify-between">
                <span>Paid:</span>
                <span className="font-semibold text-gray-900">{formatCurrency(order.amountPaid)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Actions</h3>
            <div className="space-y-2">
              {order.status === 'PENDING' && (
                <button
                  onClick={handleConfirm}
                  disabled={updating}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {updating ? 'Confirming...' : 'Confirm Order'}
                </button>
              )}

              {order.status === 'CONFIRMED' && (
                <button
                  onClick={handleFulfill}
                  disabled={updating}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {updating ? 'Fulfilling...' : 'Mark as Fulfilled'}
                </button>
              )}

              {order.status === 'FULFILLED' && (
                <p className="text-sm text-green-700 bg-green-50 border border-green-200 p-3 rounded-lg">
                  Delivered on {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('en-IN') : 'N/A'}
                </p>
              )}

              <button
                onClick={handleDelete}
                className="w-full px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
              >
                Delete Order
              </button>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Order Timeline</h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2">
                <span className="text-blue-600 font-bold mt-0.5">✓</span>
                <div>
                  <p className="font-medium text-gray-900">Order Created</p>
                  <p className="text-gray-500">{new Date(order.createdAt).toLocaleDateString('en-IN')}</p>
                </div>
              </div>

              {order.status !== 'PENDING' && (
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold mt-0.5">✓</span>
                  <div>
                    <p className="font-medium text-gray-900">Order Confirmed</p>
                    <p className="text-gray-500">—</p>
                  </div>
                </div>
              )}

              {order.status === 'FULFILLED' && (
                <div className="flex items-start gap-2">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <div>
                    <p className="font-medium text-gray-900">Fulfilled</p>
                    <p className="text-gray-500">
                      {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('en-IN') : '—'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Links */}
          <div className="space-y-2">
            <Link
              href={`/customers/${order.customer.id}`}
              className="block w-full text-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              View Customer
            </Link>
            {order.quotation && (
              <Link
                href={`/quotations/${order.quotation.id}`}
                className="block w-full text-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                View Quotation
              </Link>
            )}
            {order.deal && (
              <Link
                href={`/pipeline/${order.deal.id}`}
                className="block w-full text-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                View Deal
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
