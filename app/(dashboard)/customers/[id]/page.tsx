'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

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
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Delete-approval request state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  // Edit state
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editForm, setEditForm] = useState({
    companyName: '',
    gstNumber: '',
    industry: '',
    website: '',
    annualRevenue: '',
    yearEstablished: '',
    customerCategory: 'ACTIVE',
    billingAddress: '',
    shippingAddress: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    contactDesignation: '',
  });

  const openEdit = async () => {
    setEditError('');
    const customerId = lead?.linkedCustomerId;
    if (!customerId) {
      alert('This customer is not linked to a customer record yet and cannot be edited.');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/customers/${customerId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load customer');
      const c = await res.json();
      const primary = (c.contacts || [])[0] || {};
      setEditForm({
        companyName: c.companyName || '',
        gstNumber: c.gstNumber || '',
        industry: c.industry || '',
        website: c.website || '',
        annualRevenue: c.annualRevenue != null ? String(c.annualRevenue) : '',
        yearEstablished: c.yearEstablished != null ? String(c.yearEstablished) : '',
        customerCategory: c.customerCategory || 'ACTIVE',
        billingAddress: c.billingAddress?.street || '',
        shippingAddress: c.shippingAddress?.street || '',
        contactName: primary.name || '',
        contactEmail: primary.email || '',
        contactPhone: primary.phone || '',
        contactDesignation: primary.designation || '',
      });
      setShowEditModal(true);
    } catch {
      alert('Could not load customer details for editing.');
    }
  };

  const handleEditChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveEdit = async () => {
    setEditError('');
    const customerId = lead?.linkedCustomerId;
    if (!customerId) return;
    if (!editForm.gstNumber.trim()) { setEditError('GST number is required'); return; }
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      // companyName is intentionally omitted — it cannot be edited.
      const { companyName: _companyName, ...payload } = editForm;
      const res = await fetch(`/api/customers/${customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Failed to update'); }
      setShowEditModal(false);
      fetchCustomerData();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRequest = async () => {
    if (!deleteReason.trim()) { alert('Please enter a reason'); return; }
    // The Customer record's id (set as linkedCustomerId in fetchCustomerData).
    const customerId = lead?.linkedCustomerId;
    if (!customerId) {
      alert('This customer is not linked to a customer record yet and cannot be deleted.');
      return;
    }
    setRequesting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/approval-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ entityId: customerId, type: 'CUSTOMER_DELETE', reason: deleteReason }),
      });
      if (res.ok) { setDeleteSuccess(true); }
      else { const e = await res.json(); alert(e.message || 'Failed to submit request'); }
    } catch { alert('An error occurred'); }
    finally { setRequesting(false); }
  };

  useEffect(() => {
    fetchCustomerData();
  }, [id]);

  const fetchCustomerData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      // Fetch lead details (won-lead customers). Fall back to a manually
      // created Customer record if this id isn't a lead.
      const leadRes = await fetch(`/api/leads/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (leadRes.ok) {
        const leadData = await leadRes.json();
        setLead(leadData);
      } else {
        const custRes = await fetch(`/api/customers/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (custRes.ok) {
          const c = await custRes.json();
          const primary = (c.contacts || [])[0];
          setLead({
            id: c.id,
            name: primary?.name || '—',
            email: primary?.email || '—',
            phone: primary?.phone,
            company: c.companyName,
            address: c.billingAddress?.street,
            gstNumber: c.gstNumber,
            source: 'CUSTOMER',
            quoteValue: undefined,
            closedAt: c.createdAt,
            linkedCustomerId: c.id,
          });
          setQuotations(c.quotations || []);
          setOrders(c.orders || []);
        }
      }

      // For won-leads, quotations/orders come from the lead-scoped endpoints.
      // (Manually created customers already had these set above.)
      if (leadRes.ok) {
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
          {lead.source !== 'CUSTOMER' && (
            <Link href={`/leads/${lead.id}`} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              View Lead Details
            </Link>
          )}
          {lead.linkedCustomerId && (
            <button
              onClick={openEdit}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              ✏️ Edit Customer
            </button>
          )}
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50"
          >
            Request Deletion
          </button>
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

      {/* ── Edit Modal ─────────────────────────────────────────────── */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="border-b px-6 py-4 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-lg font-bold text-gray-900">Edit Customer</h2>
              <button onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-6">
              {editError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{editError}</div>
              )}

              {/* Company */}
              <div>
                <h3 className="text-sm font-semibold mb-3 text-gray-800 border-b pb-2">Company Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Company Name</label>
                    <input type="text" value={editForm.companyName} readOnly disabled
                      className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-500 cursor-not-allowed" />
                    <p className="text-xs text-gray-400 mt-1">Company name cannot be changed.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">GST Number *</label>
                    <input type="text" name="gstNumber" value={editForm.gstNumber} onChange={handleEditChange}
                      className="w-full border rounded px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Category</label>
                    <select name="customerCategory" value={editForm.customerCategory} onChange={handleEditChange}
                      className="w-full border rounded px-3 py-2">
                      <option value="ACTIVE">Active</option>
                      <option value="PROSPECT">Prospect</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="LOST">Lost</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Industry</label>
                    <input type="text" name="industry" value={editForm.industry} onChange={handleEditChange}
                      className="w-full border rounded px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Website</label>
                    <input type="text" name="website" value={editForm.website} onChange={handleEditChange}
                      className="w-full border rounded px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Annual Revenue (₹)</label>
                    <input type="number" name="annualRevenue" value={editForm.annualRevenue} onChange={handleEditChange}
                      min="0" className="w-full border rounded px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Year Established</label>
                    <input type="number" name="yearEstablished" value={editForm.yearEstablished} onChange={handleEditChange}
                      min="1800" max={new Date().getFullYear()} className="w-full border rounded px-3 py-2" />
                  </div>
                </div>
              </div>

              {/* Addresses */}
              <div>
                <h3 className="text-sm font-semibold mb-3 text-gray-800 border-b pb-2">Addresses</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Billing Address</label>
                    <textarea name="billingAddress" value={editForm.billingAddress} onChange={handleEditChange}
                      rows={2} className="w-full border rounded px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Shipping Address</label>
                    <textarea name="shippingAddress" value={editForm.shippingAddress} onChange={handleEditChange}
                      rows={2} className="w-full border rounded px-3 py-2" />
                  </div>
                </div>
              </div>

              {/* Primary Contact */}
              <div>
                <h3 className="text-sm font-semibold mb-3 text-gray-800 border-b pb-2">Primary Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Contact Name</label>
                    <input type="text" name="contactName" value={editForm.contactName} onChange={handleEditChange}
                      className="w-full border rounded px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Designation</label>
                    <input type="text" name="contactDesignation" value={editForm.contactDesignation} onChange={handleEditChange}
                      className="w-full border rounded px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <input type="email" name="contactEmail" value={editForm.contactEmail} onChange={handleEditChange}
                      className="w-full border rounded px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Phone</label>
                    <input type="tel" name="contactPhone" value={editForm.contactPhone} onChange={handleEditChange}
                      className="w-full border rounded px-3 py-2" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t">
                <button onClick={handleSaveEdit} disabled={saving}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button onClick={() => setShowEditModal(false)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Approval Modal ──────────────────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Request Customer Deletion</h2>
              <button onClick={() => { setShowDeleteModal(false); setDeleteReason(''); setDeleteSuccess(false); }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              {deleteSuccess ? (
                <div className="text-center py-6">
                  <p className="text-4xl mb-3">✅</p>
                  <p className="text-lg font-bold text-gray-900">Request Submitted</p>
                  <p className="text-sm text-gray-500 mt-2">An admin will review and approve the deletion.</p>
                  <button onClick={() => router.push('/customers')}
                    className="mt-5 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
                    Back to Customers
                  </button>
                </div>
              ) : (
                <>
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <strong>Note:</strong> Deleting a customer requires admin approval. Your request will be sent to the approvals queue.
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-sm">
                    <p className="font-medium text-gray-700">Customer: {lead.company}</p>
                    <p className="text-gray-500">Contact: {lead.name}{lead.gstNumber ? ` · ${lead.gstNumber}` : ''}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Reason for deletion *</label>
                    <textarea rows={3} value={deleteReason} onChange={e => setDeleteReason(e.target.value)}
                      placeholder="Explain why this customer should be deleted..."
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleDeleteRequest} disabled={requesting || !deleteReason.trim()}
                      className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
                      {requesting ? 'Submitting...' : 'Submit Request'}
                    </button>
                    <button onClick={() => setShowDeleteModal(false)}
                      className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
