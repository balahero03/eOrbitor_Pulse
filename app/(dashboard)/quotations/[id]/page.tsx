'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Quotation {
  id: string;
  quotationNumber: string;
  status: string;
  customer: { id: string; companyName: string };
  deal: { id: string; dealName: string };
  items: any[];
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  notes?: string;
  issueDate: string;
  expiryDate?: string;
  sentAt?: string;
  approvedAt?: string;
  createdBy: { firstName: string; lastName: string };
  createdAt: string;
  orders: any[];
}

export default function QuotationDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchQuotation();
  }, [params.id]);

  const fetchQuotation = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/quotations/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch quotation');

      const data = await res.json();
      setQuotation(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    setUpdating(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/quotations/${params.id}/send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to send quotation');

      const updated = await res.json();
      setQuotation(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };

  const handleApprove = async () => {
    setUpdating(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/quotations/${params.id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to approve quotation');

      const updated = await res.json();
      setQuotation(updated);
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
      const res = await fetch(`/api/quotations/${params.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        router.push('/quotations');
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
      maximumFractionDigits: 2,
    }).format(parseFloat(value));
  };

  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (!quotation) return <div className="p-6 text-center">Quotation not found</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">{quotation.quotationNumber}</h1>
        <Link href="/quotations" className="btn btn-secondary">Back to Quotations</Link>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-4">
          {/* Header Info */}
          <div className="card p-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Customer</p>
                <p className="text-lg font-medium">{quotation.customer.companyName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Deal</p>
                <p className="text-lg font-medium">{quotation.deal.dealName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Issue Date</p>
                <p className="text-lg font-medium">{new Date(quotation.issueDate).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Status</p>
                <span className={`badge px-3 py-1 rounded font-medium ${getStatusBadgeColor(quotation.status)}`}>
                  {quotation.status}
                </span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="card p-6">
            <h2 className="text-lg font-bold mb-4">Items</h2>
            <div className="overflow-x-auto border border-gray-200 rounded">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left">Product</th>
                    <th className="px-4 py-2 text-right">Quantity</th>
                    <th className="px-4 py-2 text-right">Unit Price</th>
                    <th className="px-4 py-2 text-right">Tax %</th>
                    <th className="px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quotation.items.map((item: any, idx: number) => (
                    <tr key={idx} className="border-b">
                      <td className="px-4 py-2">{item.productId}</td>
                      <td className="px-4 py-2 text-right">{item.quantity}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(item.unitPrice.toString())}</td>
                      <td className="px-4 py-2 text-right">-</td>
                      <td className="px-4 py-2 text-right font-medium">
                        {formatCurrency((item.quantity * item.unitPrice).toString())}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="card p-6">
            <div className="space-y-2 text-right max-w-xs ml-auto">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>{formatCurrency(quotation.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tax:</span>
                <span>{formatCurrency(quotation.taxAmount)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold text-lg">
                <span>Total:</span>
                <span>{formatCurrency(quotation.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {quotation.notes && (
            <div className="card p-6">
              <h2 className="text-lg font-bold mb-3">Notes</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{quotation.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status & Actions */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4">Actions</h3>
            <div className="space-y-2">
              {quotation.status === 'DRAFT' && (
                <>
                  <button
                    onClick={handleSend}
                    disabled={updating}
                    className="btn btn-primary w-full"
                  >
                    {updating ? 'Sending...' : 'Send Quotation'}
                  </button>
                  <Link href={`/quotations/${params.id}/edit`} className="btn btn-secondary w-full text-center">
                    Edit
                  </Link>
                </>
              )}

              {quotation.status === 'SENT' && (
                <>
                  <button
                    onClick={handleApprove}
                    disabled={updating}
                    className="btn btn-primary w-full"
                  >
                    {updating ? 'Approving...' : 'Accept Quotation'}
                  </button>
                  <button className="btn btn-danger w-full">Reject</button>
                </>
              )}

              <button
                onClick={handleDelete}
                className="btn btn-danger w-full"
              >
                Delete
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Details</h3>
            <div className="space-y-3 text-sm">
              {quotation.sentAt && (
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Sent At</p>
                  <p>{new Date(quotation.sentAt).toLocaleDateString()}</p>
                </div>
              )}

              {quotation.expiryDate && (
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-1">Expiry Date</p>
                  <p>{new Date(quotation.expiryDate).toLocaleDateString()}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Created By</p>
                <p>{quotation.createdBy.firstName} {quotation.createdBy.lastName}</p>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Created Date</p>
                <p>{new Date(quotation.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="space-y-2">
            <Link href={`/customers/${quotation.customer.id}`} className="btn btn-secondary w-full text-center">
              View Customer
            </Link>
            <Link href={`/pipeline/${quotation.deal.id}`} className="btn btn-secondary w-full text-center">
              View Deal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
