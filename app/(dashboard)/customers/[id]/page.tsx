'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company: string;
  address?: string;
  gstNumber?: string;
  source: string;
  quoteValue?: number;
  closedAt?: string;
  linkedCustomerId?: string;
}

interface Quotation {
  id: string;
  quotationNumber: string;
  status: string;
  totalAmount: string;
  createdAt: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: string;
  createdAt: string;
}

const fmt = (v: number | string | undefined) =>
  v ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(v)) : '—';

const fmtDate = (d: string | undefined) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function CustomerDetailPage() {
  const { id } = useParams() as { id: string };
  const [lead, setLead] = useState<Lead | null>(null);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCustomerData();
  }, [id]);

  const fetchCustomerData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      // Fetch lead details
      const leadRes = await fetch(`/api/leads/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (leadRes.ok) {
        const leadData = await leadRes.json();
        setLead(leadData);
      }

      // Fetch quotations for this lead
      const quotRes = await fetch(`/api/quotations?leadId=${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (quotRes.ok) {
        const data = await quotRes.json();
        setQuotations(data.quotations || []);
      }

      // Fetch orders if customer has linkedCustomerId
      if (lead?.linkedCustomerId) {
        const ordRes = await fetch(`/api/orders`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (ordRes.ok) {
          const data = await ordRes.json();
          setOrders(data.orders || []);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading customer details...</p>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Customer not found</p>
          <Link href="/customers" className="text-blue-600 hover:underline">
            ← Back to Customers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{lead.company}</h1>
          <p className="text-sm text-gray-600 mt-1">Contact: {lead.name}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/customers" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
            ← Back to Customers
          </Link>
          <Link href={`/leads/${lead.id}`} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            View Lead Details
          </Link>
        </div>
      </div>

      {/* Customer Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-bold mb-4 text-gray-900">Customer Information</h2>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Contact Name</p>
              <p className="text-sm font-medium text-gray-900 mt-1">{lead.name}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Email</p>
              <p className="text-sm text-gray-700 mt-1">{lead.email}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Phone</p>
              <p className="text-sm text-gray-700 mt-1">{lead.phone || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Address</p>
              <p className="text-sm text-gray-700 mt-1">{lead.address || '—'}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-bold mb-4 text-gray-900">Business Information</h2>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">GST Number</p>
              <p className="text-sm font-mono bg-blue-50 text-blue-800 px-2 py-1 rounded mt-1 inline-block">{lead.gstNumber || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Source</p>
              <p className="text-sm text-gray-700 mt-1">{lead.source}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Won Value</p>
              <p className="text-lg font-bold text-green-600 mt-1">{fmt(lead.quoteValue)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Won Date</p>
              <p className="text-sm text-gray-700 mt-1">{fmtDate(lead.closedAt)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quotations */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Quotations</h2>
          <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{quotations.length}</span>
        </div>
        {quotations.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            <p>No quotations for this customer</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Quotation No.</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {quotations.map(q => (
                  <tr key={q.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">{q.quotationNumber}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        q.status === 'SENT' ? 'bg-blue-100 text-blue-700' :
                        q.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {q.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right font-semibold text-gray-900">{fmt(q.totalAmount)}</td>
                    <td className="px-6 py-3 text-gray-600">{fmtDate(q.createdAt)}</td>
                    <td className="px-6 py-3">
                      <Link href={`/quotations/${q.id}`} className="text-blue-600 hover:text-blue-800 text-xs font-medium hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Orders */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Orders</h2>
          <span className="text-sm font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full">{orders.length}</span>
        </div>
        {orders.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">
            <p>No orders for this customer yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Order No.</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Payment Status</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map(o => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">{o.orderNumber}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        o.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                        o.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-700' :
                        o.status === 'FULFILLED' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        o.paymentStatus === 'PENDING' ? 'bg-red-100 text-red-700' :
                        o.paymentStatus === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {o.paymentStatus}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right font-semibold text-gray-900">{fmt(o.totalAmount)}</td>
                    <td className="px-6 py-3 text-gray-600">{fmtDate(o.createdAt)}</td>
                    <td className="px-6 py-3">
                      <Link href={`/orders/${o.id}`} className="text-blue-600 hover:text-blue-800 text-xs font-medium hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
