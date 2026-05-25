'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Quotation {
  id: string;
  quotationNumber: string;
  customerId: string;
  customer: { companyName: string };
  dealId: string;
  deal: { dealName: string };
  totalAmount: string;
  status: string;
}

interface Deal {
  id: string;
  dealName: string;
  customerId: string;
  customer: { companyName: string };
  dealValue: string;
}

export default function NewOrderPage() {
  const router = useRouter();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orderType, setOrderType] = useState<'quotation' | 'deal'>('quotation');

  const [formData, setFormData] = useState({
    quotationId: '',
    dealId: '',
    customerId: '',
    poNumber: '',
    poDate: '',
    totalAmount: '',
  });

  useEffect(() => {
    fetchQuotations();
    fetchDeals();
  }, []);

  const fetchQuotations = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/quotations?status=ACCEPTED&limit=1000', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch quotations');

      const data = await res.json();
      setQuotations(data.quotations);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDeals = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/deals?limit=1000', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch deals');

      const data = await res.json();
      setDeals(data.deals);
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuotationChange = (quotationId: string) => {
    const quotation = quotations.find(q => q.id === quotationId);
    if (quotation) {
      setFormData({
        ...formData,
        quotationId,
        customerId: quotation.customerId,
        dealId: quotation.dealId,
        totalAmount: quotation.totalAmount,
      });
    }
  };

  const handleDealChange = (dealId: string) => {
    const deal = deals.find(d => d.id === dealId);
    if (deal) {
      setFormData({
        ...formData,
        dealId,
        customerId: deal.customerId,
        totalAmount: deal.dealValue,
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!formData.customerId || !formData.totalAmount) {
        throw new Error('Customer and total amount are required');
      }

      const token = localStorage.getItem('token');
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          quotationId: formData.quotationId || undefined,
          customerId: formData.customerId,
          dealId: formData.dealId || undefined,
          poNumber: formData.poNumber || undefined,
          poDate: formData.poDate || undefined,
          totalAmount: parseFloat(formData.totalAmount),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to create order');
      }

      const newOrder = await res.json();
      router.push(`/orders/${newOrder.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(parseFloat(value) || 0);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Create New Order</h1>
        <Link href="/orders" className="btn btn-secondary">Back to Orders</Link>
      </div>

      <div className="card p-8 max-w-2xl">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Order Type Selection */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Order Type</h3>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="quotation"
                  checked={orderType === 'quotation'}
                  onChange={(e) => {
                    setOrderType(e.target.value as 'quotation' | 'deal');
                    setFormData({ ...formData, dealId: '', totalAmount: '' });
                  }}
                />
                <span>From Quotation</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="deal"
                  checked={orderType === 'deal'}
                  onChange={(e) => {
                    setOrderType(e.target.value as 'quotation' | 'deal');
                    setFormData({ ...formData, quotationId: '', totalAmount: '' });
                  }}
                />
                <span>From Deal</span>
              </label>
            </div>
          </div>

          {/* Deal/Quotation Selection */}
          <div>
            <h3 className="text-lg font-semibold mb-4">
              {orderType === 'quotation' ? 'Quotation' : 'Deal'} Details
            </h3>
            <div className="space-y-4">
              {orderType === 'quotation' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Quotation *</label>
                    <select
                      value={formData.quotationId}
                      onChange={(e) => handleQuotationChange(e.target.value)}
                      className="w-full"
                      required
                    >
                      <option value="">Select a quotation</option>
                      {quotations.map(q => (
                        <option key={q.id} value={q.id}>
                          {q.quotationNumber} - {q.customer.companyName} ({formatCurrency(q.totalAmount)})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Deal *</label>
                    <select
                      value={formData.dealId}
                      onChange={(e) => handleDealChange(e.target.value)}
                      className="w-full"
                      required
                    >
                      <option value="">Select a deal</option>
                      {deals.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.dealName} - {d.customer.companyName}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* PO Details */}
          <div>
            <h3 className="text-lg font-semibold mb-4">PO Details</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">PO Number</label>
                  <input
                    type="text"
                    name="poNumber"
                    value={formData.poNumber}
                    onChange={handleChange}
                    placeholder="PO-2026-001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">PO Date</label>
                  <input
                    type="date"
                    name="poDate"
                    value={formData.poDate}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Order Total Amount *</label>
                <input
                  type="number"
                  name="totalAmount"
                  value={formData.totalAmount}
                  onChange={handleChange}
                  placeholder="0"
                  step="0.01"
                  required
                />
                {formData.totalAmount && (
                  <p className="text-sm text-gray-600 mt-1">
                    {formatCurrency(formData.totalAmount)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary flex-1"
            >
              {loading ? 'Creating...' : 'Create Order'}
            </button>
            <Link href="/orders" className="btn btn-secondary flex-1 text-center">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
