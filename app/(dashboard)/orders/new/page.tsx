'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AttachmentIcon, QuotationIcon, CloseIcon } from '@/components/icons';

interface WonLead {
  id: string;
  name: string;
  company: string;
  quoteValue?: string;
  linkedCustomerId?: string;
}

interface LeadQuotation {
  id: string;
  quotationNumber: string;
  totalAmount: string;
  status: string;
}

const PAYMENT_MODES = ['Bank Transfer', 'Cheque', 'Cash', 'UPI', 'NEFT', 'RTGS', 'DD', 'Credit Card', 'Other'];

export default function NewOrderPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [wonLeads, setWonLeads] = useState<WonLead[]>([]);
  const [leadQuotations, setLeadQuotations] = useState<LeadQuotation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [proofFile, setProofFile] = useState<{ name: string; dataUrl: string } | null>(null);

  const [formData, setFormData] = useState({
    leadId: '',
    quotationId: '',
    poNumber: '',
    poDate: '',
    totalAmount: '',
    amountPaid: '',
    paymentMode: '',
    paymentRemarks: '',
  });

  const selectedLead = wonLeads.find(l => l.id === formData.leadId);
  const total = parseFloat(formData.totalAmount) || 0;
  const paid = parseFloat(formData.amountPaid) || 0;
  const balance = total - paid;
  const paymentStatus = paid >= total && paid > 0 ? 'COMPLETED' : paid > 0 ? 'PARTIAL' : 'PENDING';

  useEffect(() => { fetchWonLeads(); }, []);

  useEffect(() => {
    if (formData.leadId) {
      fetchLeadQuotations(formData.leadId);
      const lead = wonLeads.find(l => l.id === formData.leadId);
      if (lead?.quoteValue) {
        setFormData(prev => ({ ...prev, totalAmount: String(lead.quoteValue), quotationId: '' }));
      }
    } else {
      setLeadQuotations([]);
    }
  }, [formData.leadId]);

  useEffect(() => {
    if (formData.quotationId) {
      const q = leadQuotations.find(q => q.id === formData.quotationId);
      if (q) setFormData(prev => ({ ...prev, totalAmount: q.totalAmount }));
    }
  }, [formData.quotationId]);

  const fetchWonLeads = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/leads/won?limit=200', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setWonLeads(data.customers || []);
      }
    } catch (err) { console.error(err); }
  };

  const fetchLeadQuotations = async (leadId: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/quotations?leadId=${leadId}&limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLeadQuotations(data.quotations || []);
      }
    } catch (err) { console.error(err); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('File must be under 5 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setProofFile({ name: file.name, dataUrl: reader.result as string });
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.leadId) { setError('Please select a customer'); return; }
    if (!formData.totalAmount) { setError('Order total amount is required'); return; }

    setLoading(true);
    try {
      const lead = wonLeads.find(l => l.id === formData.leadId);
      const customerId = lead?.linkedCustomerId;
      if (!customerId) {
        setError('This lead does not have a linked customer record. Contact support.');
        return;
      }

      const token = localStorage.getItem('token');
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customerId,
          quotationId: formData.quotationId || undefined,
          poNumber: formData.poNumber || undefined,
          poDate: formData.poDate || undefined,
          totalAmount: parseFloat(formData.totalAmount),
          amountPaid: parseFloat(formData.amountPaid) || 0,
          paymentMode: formData.paymentMode || undefined,
          paymentRemarks: formData.paymentRemarks || undefined,
          paymentProofUrl: proofFile?.dataUrl || undefined,
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

  const fmt = (v: string | number | undefined) =>
    v !== undefined && v !== ''
      ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(v))
      : '';

  const statusColor: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    PARTIAL: 'bg-blue-100 text-blue-700',
    COMPLETED: 'bg-green-100 text-green-700',
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Create New Order</h1>
        <Link href="/orders" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
          Back to Orders
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 max-w-2xl">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
        )}

        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <strong>Note:</strong> Orders are auto-created when a lead is won. Use this form to create additional orders for existing customers.
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Customer */}
          <div>
            <h3 className="text-lg font-semibold mb-4 border-b pb-2">Customer</h3>
            <div>
              <label className="block text-sm font-medium mb-1">Select Customer *</label>
              <select
                name="leadId"
                value={formData.leadId}
                onChange={handleChange}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                required
              >
                <option value="">— Select a won customer —</option>
                {wonLeads.map(lead => (
                  <option key={lead.id} value={lead.id}>
                    {lead.company} — {lead.name}{lead.quoteValue ? ` (${fmt(lead.quoteValue)})` : ''}
                  </option>
                ))}
              </select>
              {selectedLead && (
                <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                  <strong>{selectedLead.company}</strong> · Contact: {selectedLead.name}
                  {selectedLead.quoteValue && <span> · Won Value: {fmt(selectedLead.quoteValue)}</span>}
                </div>
              )}
            </div>
          </div>

          {/* Quotation */}
          {formData.leadId && (
            <div>
              <h3 className="text-lg font-semibold mb-4 border-b pb-2">Link to Quotation (Optional)</h3>
              {leadQuotations.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No quotations found for this customer</p>
              ) : (
                <select
                  name="quotationId"
                  value={formData.quotationId}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">— None (manual order) —</option>
                  {leadQuotations.map(q => (
                    <option key={q.id} value={q.id}>
                      {q.quotationNumber} · {fmt(q.totalAmount)} · {q.status}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* PO Details */}
          <div>
            <h3 className="text-lg font-semibold mb-4 border-b pb-2">PO Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">PO Number</label>
                <input
                  type="text"
                  name="poNumber"
                  value={formData.poNumber}
                  onChange={handleChange}
                  placeholder="PO-2026-001"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">PO Date</label>
                <input
                  type="date"
                  name="poDate"
                  value={formData.poDate}
                  onChange={handleChange}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>
          </div>

          {/* Order Amount */}
          <div>
            <h3 className="text-lg font-semibold mb-4 border-b pb-2">Order Amount</h3>
            <div>
              <label className="block text-sm font-medium mb-1">Total Order Amount (₹) *</label>
              <input
                type="number"
                name="totalAmount"
                value={formData.totalAmount}
                onChange={handleChange}
                placeholder="0"
                min="0"
                step="0.01"
                required
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              {formData.totalAmount && (
                <p className="text-sm font-semibold text-gray-700 mt-1">{fmt(formData.totalAmount)}</p>
              )}
            </div>
          </div>

          {/* Payment Details */}
          <div>
            <h3 className="text-lg font-semibold mb-4 border-b pb-2">Payment Details</h3>
            <div className="space-y-4">

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Amount Paid (₹)</label>
                  <input
                    type="number"
                    name="amountPaid"
                    value={formData.amountPaid}
                    onChange={handleChange}
                    placeholder="0"
                    min="0"
                    step="0.01"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Payment Mode</label>
                  <select
                    name="paymentMode"
                    value={formData.paymentMode}
                    onChange={handleChange}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="">— Select mode —</option>
                    {PAYMENT_MODES.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Payment summary */}
              {formData.totalAmount && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 uppercase font-medium">Total</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">{fmt(total)}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500 uppercase font-medium">Paid</p>
                    <p className="text-sm font-bold text-green-700 mt-1">{fmt(paid)}</p>
                  </div>
                  <div className={`rounded-lg p-3 text-center ${balance > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                    <p className="text-xs text-gray-500 uppercase font-medium">Balance</p>
                    <p className={`text-sm font-bold mt-1 ${balance > 0 ? 'text-red-600' : 'text-green-700'}`}>{fmt(balance)}</p>
                  </div>
                </div>
              )}

              {/* Payment status badge */}
              {formData.totalAmount && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">Payment Status:</span>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${statusColor[paymentStatus]}`}>
                    {paymentStatus}
                  </span>
                </div>
              )}

              {/* Payment Proof */}
              <div>
                <label className="block text-sm font-medium mb-1">Payment Proof (Optional)</label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  {proofFile ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-green-700">
                      <AttachmentIcon className="w-4 h-4" />
                      <span className="font-medium">{proofFile.name}</span>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setProofFile(null); if (fileRef.current) fileRef.current.value = ''; }}
                        className="ml-2 text-red-500 hover:text-red-700"
                      >
                        <CloseIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-gray-500 flex flex-col items-center">
                      <QuotationIcon className="w-7 h-7 mb-1" color="text-gray-400" />
                      <p className="text-sm font-medium">Click to upload payment proof</p>
                      <p className="text-xs text-gray-400 mt-1">PNG, JPG, PDF — max 5 MB</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-sm font-medium mb-1">Payment Remarks</label>
                <textarea
                  name="paymentRemarks"
                  value={formData.paymentRemarks}
                  onChange={handleChange}
                  rows={3}
                  placeholder="e.g. Partial advance received via NEFT, balance due by 30 Jun..."
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Order'}
            </button>
            <Link href="/orders" className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 text-center">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
