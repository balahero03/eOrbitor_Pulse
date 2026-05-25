'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');

  useEffect(() => {
    fetchOrder();
  }, [params.id]);

  const fetchOrder = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/orders/${params.id}`, {
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
      const res = await fetch(`/api/orders/${params.id}/confirm`, {
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
      const res = await fetch(`/api/orders/${params.id}/fulfill`, {
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
      const res = await fetch(`/api/orders/${params.id}/payment`, {
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
      const res = await fetch(`/api/orders/${params.id}`, {
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
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'CONFIRMED': return 'bg-blue-100 text-blue-800';
      case 'FULFILLED': return 'bg-green-100 text-green-800';
      case 'INVOICED': return 'bg-purple-100 text-purple-800';
      case 'COMPLETED': return 'bg-emerald-100 text-emerald-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentBadgeColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-red-100 text-red-800';
      case 'PARTIAL': return 'bg-orange-100 text-orange-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
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

  const getPaymentProgress = () => {
    const total = parseFloat(order?.totalAmount || '0');
    const paid = parseFloat(order?.amountPaid || '0');
    return (paid / total) * 100;
  };

  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (!order) return <div className="p-6 text-center">Order not found</div>;

  const remainingAmount = parseFloat(order.totalAmount) - parseFloat(order.amountPaid);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">{order.orderNumber}</h1>
        <Link href="/orders" className="btn btn-secondary">Back to Orders</Link>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-4">
          {/* Header Info */}
          <div className="card p-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Customer</p>
                <p className="text-lg font-medium">{order.customer.companyName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Order Status</p>
                <span className={`badge px-3 py-1 rounded font-medium ${getStatusBadgeColor(order.status)}`}>
                  {order.status}
                </span>
              </div>
              {order.quotation && (
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Quotation</p>
                  <p className="text-lg font-medium">{order.quotation.quotationNumber}</p>
                </div>
              )}
              {order.deal && (
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Deal</p>
                  <p className="text-lg font-medium">{order.deal.dealName}</p>
                </div>
              )}
            </div>
          </div>

          {/* PO Details */}
          <div className="card p-6">
            <h2 className="text-lg font-bold mb-4">PO Details</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">PO Number</p>
                <p className="text-lg font-medium">{order.poNumber || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">PO Date</p>
                <p className="text-lg font-medium">
                  {order.poDate ? new Date(order.poDate).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Order Amount */}
          <div className="card p-6">
            <h2 className="text-lg font-bold mb-4">Order Amount</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span>Order Total:</span>
                <span className="font-medium">{formatCurrency(order.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Amount Paid:</span>
                <span className="font-medium">{formatCurrency(order.amountPaid)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold">
                <span>Outstanding:</span>
                <span>{formatCurrency(remainingAmount.toString())}</span>
              </div>

              {/* Payment Progress */}
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all"
                    style={{ width: `${getPaymentProgress()}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  {getPaymentProgress().toFixed(0)}% paid
                </p>
              </div>
            </div>
          </div>

          {/* Payment Input */}
          {order.paymentStatus !== 'COMPLETED' && (
            <div className="card p-6">
              <h2 className="text-lg font-bold mb-4">Add Payment</h2>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Amount to pay"
                  step="0.01"
                  className="flex-1"
                />
                <button
                  onClick={handleAddPayment}
                  disabled={updating}
                  className="btn btn-primary"
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
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-3">Payment Status</h3>
            <span className={`badge px-3 py-1 rounded font-medium ${getPaymentBadgeColor(order.paymentStatus)}`}>
              {order.paymentStatus}
            </span>
            <div className="mt-4 text-sm space-y-2">
              <p>Due: <span className="font-medium">{formatCurrency(remainingAmount.toString())}</span></p>
              <p>Paid: <span className="font-medium">{formatCurrency(order.amountPaid)}</span></p>
            </div>
          </div>

          {/* Actions */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-3">Actions</h3>
            <div className="space-y-2">
              {order.status === 'PENDING' && (
                <button
                  onClick={handleConfirm}
                  disabled={updating}
                  className="btn btn-primary w-full"
                >
                  {updating ? 'Confirming...' : 'Confirm Order'}
                </button>
              )}

              {order.status === 'CONFIRMED' && (
                <button
                  onClick={handleFulfill}
                  disabled={updating}
                  className="btn btn-primary w-full"
                >
                  {updating ? 'Fulfilling...' : 'Mark as Fulfilled'}
                </button>
              )}

              {order.status === 'FULFILLED' && (
                <p className="text-sm text-green-700 bg-green-50 p-2 rounded">
                  Delivered on {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : 'N/A'}
                </p>
              )}

              <button
                onClick={handleDelete}
                className="btn btn-danger w-full"
              >
                Delete Order
              </button>
            </div>
          </div>

          {/* Timeline */}
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Order Timeline</h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2">
                <span className="text-blue-600 font-bold">✓</span>
                <div>
                  <p className="font-medium">Order Created</p>
                  <p className="text-gray-600">{new Date(order.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              {order.status !== 'PENDING' && (
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">✓</span>
                  <div>
                    <p className="font-medium">Order Confirmed</p>
                    <p className="text-gray-600">-</p>
                  </div>
                </div>
              )}

              {order.status === 'FULFILLED' && (
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">✓</span>
                  <div>
                    <p className="font-medium">Fulfilled</p>
                    <p className="text-gray-600">
                      {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : '-'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Links */}
          <div className="space-y-2">
            <Link href={`/customers/${order.customer.id}`} className="btn btn-secondary w-full text-center">
              View Customer
            </Link>
            {order.quotation && (
              <Link href={`/quotations/${order.quotation.id}`} className="btn btn-secondary w-full text-center">
                View Quotation
              </Link>
            )}
            {order.deal && (
              <Link href={`/pipeline/${order.deal.id}`} className="btn btn-secondary w-full text-center">
                View Deal
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
