'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
  // Extended fields
  priceValidity?: string;
  taxDetails?: string;
  warranty?: string;
  amcPeriod?: string;
  deliveryEstimate?: string;
  paymentTerms?: string;
}

export default function QuotationDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchQuotation();
  }, [id]);

  const fetchQuotation = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/quotations/${id}`, {
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
      const res = await fetch(`/api/quotations/${id}/send`, {
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
      const res = await fetch(`/api/quotations/${id}/approve`, {
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
      const res = await fetch(`/api/quotations/${id}`, {
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
      case 'DRAFT':    return 'bg-gray-100 text-gray-700 border-gray-300';
      case 'SENT':     return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'ACCEPTED': return 'bg-green-100 text-green-800 border-green-300';
      case 'REJECTED': return 'bg-red-100 text-red-800 border-red-300';
      case 'EXPIRED':  return 'bg-orange-100 text-orange-800 border-orange-300';
      default:         return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(parseFloat(value));
  };

  if (loading) return (
    <div className="p-6 text-center text-gray-500">Loading...</div>
  );
  if (!quotation) return (
    <div className="p-6 text-center text-gray-500">Quotation not found</div>
  );

  // Collect any non-empty extended fields for display
  const extendedFields = [
    { label: 'Price Validity',     value: quotation.priceValidity },
    { label: 'Tax Details',        value: quotation.taxDetails },
    { label: 'Warranty',           value: quotation.warranty },
    { label: 'AMC Period',         value: quotation.amcPeriod },
    { label: 'Delivery Estimate',  value: quotation.deliveryEstimate },
    { label: 'Payment Terms',      value: quotation.paymentTerms },
  ].filter(f => f.value);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{quotation.quotationNumber}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{quotation.customer.companyName}</p>
        </div>
        <Link
          href="/quotations"
          className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          ← Back to Quotations
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
                <p className="text-base font-semibold text-gray-900">{quotation.customer.companyName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">Deal</p>
                <p className="text-base font-semibold text-gray-900">{quotation.deal.dealName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">Issue Date</p>
                <p className="text-base font-medium text-gray-900">{new Date(quotation.issueDate).toLocaleDateString('en-IN')}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">Status</p>
                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${getStatusBadgeColor(quotation.status)}`}>
                  {quotation.status}
                </span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-bold text-gray-900 mb-4">Items</h2>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Product</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Qty</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Unit Price</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Tax %</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {quotation.items.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">{item.productId}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(item.unitPrice.toString())}</td>
                      <td className="px-4 py-3 text-right text-gray-500">—</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {formatCurrency((item.quantity * item.unitPrice).toString())}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="space-y-2 text-right max-w-xs ml-auto">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal:</span>
                <span className="font-medium text-gray-900">{formatCurrency(quotation.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Tax:</span>
                <span className="font-medium text-gray-900">{formatCurrency(quotation.taxAmount)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-lg">
                <span className="text-gray-900">Total:</span>
                <span className="text-gray-900">{formatCurrency(quotation.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Extended quotation fields */}
          {extendedFields.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-base font-bold text-gray-900 mb-4">Terms & Conditions</h2>
              <div className="grid grid-cols-2 gap-4">
                {extendedFields.map(field => (
                  <div key={field.label}>
                    <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">{field.label}</p>
                    <p className="text-sm text-gray-900">{field.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {quotation.notes && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-base font-bold text-gray-900 mb-3">Notes</h2>
              <p className="text-gray-700 text-sm whitespace-pre-wrap">{quotation.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Actions */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Actions</h3>
            <div className="space-y-2">
              {quotation.status === 'DRAFT' && (
                <>
                  <button
                    onClick={handleSend}
                    disabled={updating}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {updating ? 'Sending...' : 'Send Quotation'}
                  </button>
                  <Link
                    href={`/quotations/${id}/edit`}
                    className="block w-full text-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    Edit
                  </Link>
                </>
              )}

              {quotation.status === 'SENT' && (
                <>
                  <button
                    onClick={handleApprove}
                    disabled={updating}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {updating ? 'Approving...' : 'Accept Quotation'}
                  </button>
                  <button className="w-full px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors">
                    Reject
                  </button>
                </>
              )}

              <button
                onClick={handleDelete}
                className="w-full px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>

          {/* Details */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Details</h3>
            <div className="space-y-3 text-sm">
              {quotation.sentAt && (
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">Sent At</p>
                  <p className="text-gray-900">{new Date(quotation.sentAt).toLocaleDateString('en-IN')}</p>
                </div>
              )}

              {quotation.approvedAt && (
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">Approved At</p>
                  <p className="text-gray-900">{new Date(quotation.approvedAt).toLocaleDateString('en-IN')}</p>
                </div>
              )}

              {quotation.expiryDate && (
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">Expiry Date</p>
                  <p className={`font-medium ${new Date(quotation.expiryDate) < new Date() ? 'text-red-600' : 'text-gray-900'}`}>
                    {new Date(quotation.expiryDate).toLocaleDateString('en-IN')}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">Created By</p>
                <p className="text-gray-900">{quotation.createdBy.firstName} {quotation.createdBy.lastName}</p>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">Created Date</p>
                <p className="text-gray-900">{new Date(quotation.createdAt).toLocaleDateString('en-IN')}</p>
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="space-y-2"></div>
        </div>
      </div>
    </div>
  );
}
