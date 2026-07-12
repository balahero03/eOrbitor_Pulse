'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { EditIcon, DownloadIcon, CheckGlyph, AttachmentIcon, QuotationIcon, CloseIcon, SuccessIcon } from '@/components/icons';

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
  paymentMode?: string;
  paymentRemarks?: string;
  paymentProofUrl?: string;
  poDate?: string;
  deliveryDate?: string;
  invoiceUrl?: string;
  createdAt: string;
}

const PAYMENT_MODES = ['Bank Transfer', 'Cheque', 'Cash', 'UPI', 'NEFT', 'RTGS', 'DD', 'Credit Card', 'Other'];

const fmt = (v: string | number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(v));

const fmtDate = (d: string | undefined) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const statusColor: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-300',
  FULFILLED: 'bg-green-100 text-green-800 border-green-300',
  INVOICED: 'bg-purple-100 text-purple-800 border-purple-300',
  COMPLETED: 'bg-emerald-100 text-emerald-800 border-emerald-300',
};

const paymentColor: Record<string, string> = {
  PENDING: 'bg-red-100 text-red-800 border-red-300',
  PARTIAL: 'bg-orange-100 text-orange-800 border-orange-300',
  COMPLETED: 'bg-green-100 text-green-800 border-green-300',
};

export default function OrderDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit modal
  const [showEdit, setShowEdit] = useState(false);
  const [editData, setEditData] = useState({
    poNumber: '', poDate: '', totalAmount: '', amountPaid: '',
    paymentMode: '', paymentRemarks: '',
  });
  const [editProof, setEditProof] = useState<{ name: string; dataUrl: string } | null>(null);

  // Delete approval modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  // Current user for role-based gating
  const [currentUserRole, setCurrentUserRole] = useState('');
  const isAdminUser = ['SUPER_ADMIN', 'ADMIN'].includes(currentUserRole);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (u?.role) setCurrentUserRole(u.role); })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchOrder(); }, [id]);

  const fetchOrder = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/orders/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setOrder(data);
    } catch { } finally { setLoading(false); }
  };

  const openEdit = () => {
    if (!order) return;
    setEditData({
      poNumber: order.poNumber || '',
      poDate: order.poDate ? order.poDate.split('T')[0] : '',
      totalAmount: order.totalAmount,
      amountPaid: order.amountPaid,
      paymentMode: order.paymentMode || '',
      paymentRemarks: order.paymentRemarks || '',
    });
    setEditProof(order.paymentProofUrl ? { name: 'Existing proof', dataUrl: order.paymentProofUrl } : null);
    setShowEdit(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('File must be under 5 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setEditProof({ name: file.name, dataUrl: reader.result as string });
    reader.readAsDataURL(file);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const paid = parseFloat(editData.amountPaid) || 0;
      const total = parseFloat(editData.totalAmount) || 0;
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          poNumber: editData.poNumber,
          poDate: editData.poDate || null,
          totalAmount: total,
          amountPaid: paid,
          paymentMode: editData.paymentMode,
          paymentRemarks: editData.paymentRemarks,
          paymentProofUrl: editProof?.dataUrl ?? null,
        }),
      });
      if (!res.ok) { alert('Failed to save'); return; }
      const updated = await res.json();
      setOrder(updated);
      setShowEdit(false);
    } catch { alert('An error occurred'); }
    finally { setSaving(false); }
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/orders/${id}/confirm`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setOrder(await res.json());
    } catch { } finally { setSaving(false); }
  };

  const handleFulfill = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/orders/${id}/fulfill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ deliveryDate: new Date().toISOString() }),
      });
      if (res.ok) setOrder(await res.json());
    } catch { } finally { setSaving(false); }
  };

  const handleDeleteRequest = async () => {
    setRequesting(true);
    try {
      const token = localStorage.getItem('token');

      if (isAdminUser) {
        // Admins delete orders directly.
        const res = await fetch(`/api/orders/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          setDeleteSuccess(true);
        } else {
          const e = await res.json();
          alert(e.message || 'Failed to delete order');
        }
      } else {
        // Non-admins submit an approval request.
        if (!deleteReason.trim()) { alert('Please enter a reason'); setRequesting(false); return; }
        const res = await fetch('/api/approval-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ entityId: id, type: 'ORDER_DELETE', reason: deleteReason }),
        });
        if (res.ok) { setDeleteSuccess(true); }
        else { const e = await res.json(); alert(e.message || 'Failed to submit request'); }
      }
    } catch { alert('An error occurred'); }
    finally { setRequesting(false); }
  };

  if (loading) return <div className="p-6 text-center text-gray-500">Loading...</div>;
  if (!order) return <div className="p-6 text-center text-gray-500">Order not found</div>;

  const total = parseFloat(order.totalAmount);
  const paid = parseFloat(order.amountPaid);
  const balance = total - paid;
  const paidPct = Math.min((paid / total) * 100, 100);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{order.orderNumber}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{order.customer.companyName}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openEdit}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            <EditIcon className="w-4 h-4" /> Edit Order
          </button>
          <Link href="/orders" className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
            ← Back to Orders
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main */}
        <div className="col-span-2 space-y-4">

          {/* Info */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">Customer</p>
                <p className="text-lg font-semibold text-gray-900">{order.customer.companyName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">Order Status</p>
                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${statusColor[order.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                  {order.status}
                </span>
              </div>
              {order.quotation && (
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">Quotation</p>
                  <Link href={`/quotations/${order.quotation.id}`} className="text-blue-600 hover:underline font-medium text-sm">
                    {order.quotation.quotationNumber}
                  </Link>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">Created</p>
                <p className="text-sm text-gray-700">{fmtDate(order.createdAt)}</p>
              </div>
            </div>
          </div>

          {/* PO Details */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-bold text-gray-900 mb-4">PO Details</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">PO Number</p>
                <p className="text-sm font-medium text-gray-900">{order.poNumber || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">PO Date</p>
                <p className="text-sm font-medium text-gray-900">{fmtDate(order.poDate)}</p>
              </div>
            </div>
          </div>

          {/* Amount */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-bold text-gray-900 mb-4">Order Amount</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Order Total</span>
                <span className="font-semibold text-gray-900">{fmt(total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Amount Paid</span>
                <span className="font-semibold text-green-700">{fmt(paid)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between font-bold">
                <span>Outstanding</span>
                <span className={balance > 0 ? 'text-red-600' : 'text-green-600'}>{fmt(balance)}</span>
              </div>
              <div className="mt-2">
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div className="bg-blue-600 h-2.5 rounded-full transition-all" style={{ width: `${paidPct}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-1">{paidPct.toFixed(0)}% paid</p>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          {(order.paymentMode || order.paymentRemarks || order.paymentProofUrl) && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-base font-bold text-gray-900 mb-4">Payment Details</h2>
              <div className="space-y-3">
                {order.paymentMode && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">Payment Mode</p>
                    <p className="text-sm font-medium text-gray-900">{order.paymentMode}</p>
                  </div>
                )}
                {order.paymentRemarks && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">Remarks</p>
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{order.paymentRemarks}</p>
                  </div>
                )}
                {order.paymentProofUrl && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">Payment Proof</p>
                    {order.paymentProofUrl.startsWith('data:image') ? (
                      <img src={order.paymentProofUrl} alt="Payment proof" className="max-h-48 rounded-lg border border-gray-200 mt-1" />
                    ) : order.paymentProofUrl.startsWith('data:application/pdf') ? (
                      <a
                        href={order.paymentProofUrl}
                        download="payment-proof.pdf"
                        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline mt-1"
                      >
                        <DownloadIcon className="w-4 h-4" /> Download PDF proof
                      </a>
                    ) : (
                      <a href={order.paymentProofUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
                        View proof
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">

          {/* Payment Status */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Payment Status</h3>
            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${paymentColor[order.paymentStatus] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
              {order.paymentStatus}
            </span>
            <div className="mt-4 text-sm space-y-2 text-gray-600">
              <div className="flex justify-between">
                <span>Paid</span>
                <span className="font-semibold text-green-700">{fmt(paid)}</span>
              </div>
              <div className="flex justify-between">
                <span>Balance</span>
                <span className={`font-semibold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(balance)}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Actions</h3>
            <div className="space-y-2">
              {order.status === 'PENDING' && (
                <button onClick={handleConfirm} disabled={saving}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Processing...' : 'Confirm Order'}
                </button>
              )}
              {order.status === 'CONFIRMED' && (
                <button onClick={handleFulfill} disabled={saving}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                  {saving ? 'Processing...' : 'Mark as Fulfilled'}
                </button>
              )}
              {order.status === 'FULFILLED' && (
                <p className="text-sm text-green-700 bg-green-50 border border-green-200 p-3 rounded-lg text-center inline-flex items-center justify-center gap-1.5 w-full">
                  <CheckGlyph className="w-4 h-4" /> Delivered on {fmtDate(order.deliveryDate)}
                </p>
              )}
              <button
                onClick={() => setShowDeleteModal(true)}
                className="w-full px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50"
              >
                Request Deletion
              </button>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-4">Order Timeline</h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2">
                <CheckGlyph className="w-4 h-4 text-blue-600 mt-0.5" />
                <div><p className="font-medium text-gray-900">Order Created</p><p className="text-gray-400">{fmtDate(order.createdAt)}</p></div>
              </div>
              {order.status !== 'PENDING' && (
                <div className="flex items-start gap-2">
                  <CheckGlyph className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div><p className="font-medium text-gray-900">Confirmed</p><p className="text-gray-400">—</p></div>
                </div>
              )}
              {order.status === 'FULFILLED' && (
                <div className="flex items-start gap-2">
                  <CheckGlyph className="w-4 h-4 text-green-600 mt-0.5" />
                  <div><p className="font-medium text-gray-900">Fulfilled</p><p className="text-gray-400">{fmtDate(order.deliveryDate)}</p></div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Edit Modal ─────────────────────────────────────────────── */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="border-b px-6 py-4 flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-bold text-gray-900">Edit Order</h2>
              <button onClick={() => setShowEdit(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-5">

              {/* PO */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-3">PO Details</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">PO Number</label>
                    <input type="text" value={editData.poNumber} onChange={e => setEditData(p => ({ ...p, poNumber: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">PO Date</label>
                    <input type="date" value={editData.poDate} onChange={e => setEditData(p => ({ ...p, poDate: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                  </div>
                </div>
              </div>

              {/* Amount */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Amount</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Total Amount (₹)</label>
                    <input type="number" value={editData.totalAmount} onChange={e => setEditData(p => ({ ...p, totalAmount: e.target.value }))}
                      min="0" step="0.01"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Amount Paid (₹)</label>
                    <input type="number" value={editData.amountPaid} onChange={e => setEditData(p => ({ ...p, amountPaid: e.target.value }))}
                      min="0" step="0.01"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                  </div>
                </div>
                {/* live balance */}
                {editData.totalAmount && (
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-gray-50 rounded p-2 text-center">
                      <p className="text-gray-400 uppercase">Total</p>
                      <p className="font-bold text-gray-900">{fmt(editData.totalAmount)}</p>
                    </div>
                    <div className="bg-green-50 rounded p-2 text-center">
                      <p className="text-gray-400 uppercase">Paid</p>
                      <p className="font-bold text-green-700">{fmt(editData.amountPaid || '0')}</p>
                    </div>
                    <div className={`rounded p-2 text-center ${(parseFloat(editData.totalAmount) - parseFloat(editData.amountPaid || '0')) > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                      <p className="text-gray-400 uppercase">Balance</p>
                      <p className={`font-bold ${(parseFloat(editData.totalAmount) - parseFloat(editData.amountPaid || '0')) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {fmt(parseFloat(editData.totalAmount) - parseFloat(editData.amountPaid || '0'))}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Payment */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Payment</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Payment Mode</label>
                    <select value={editData.paymentMode} onChange={e => setEditData(p => ({ ...p, paymentMode: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                      <option value="">— Select mode —</option>
                      {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>

                  {/* Proof upload */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Payment Proof</label>
                    <div onClick={() => fileRef.current?.click()}
                      className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                      {editProof ? (
                        <div className="flex items-center justify-center gap-2 text-sm text-green-700">
                          <AttachmentIcon className="w-4 h-4" /><span className="font-medium">{editProof.name}</span>
                          <button type="button"
                            onClick={e => { e.stopPropagation(); setEditProof(null); if (fileRef.current) fileRef.current.value = ''; }}
                            className="ml-2 text-red-500 hover:text-red-700"><CloseIcon className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <div className="text-gray-500 text-sm flex flex-col items-center">
                          <p className="flex items-center gap-1.5"><QuotationIcon className="w-4 h-4" color="text-gray-400" /> Click to upload proof</p>
                          <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, PDF — max 5 MB</p>
                        </div>
                      )}
                    </div>
                    <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={handleFileChange} className="hidden" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Remarks</label>
                    <textarea rows={3} value={editData.paymentRemarks}
                      onChange={e => setEditData(p => ({ ...p, paymentRemarks: e.target.value }))}
                      placeholder="Payment notes, reference numbers..."
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                  </div>
                </div>
              </div>
            </div>
            <div className="border-t px-6 py-4 flex gap-3 flex-shrink-0">
              <button onClick={handleSaveEdit} disabled={saving}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={() => setShowEdit(false)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Modal ──────────────────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {isAdminUser ? 'Delete Order' : 'Request Order Deletion'}
              </h2>
              <button onClick={() => { setShowDeleteModal(false); setDeleteReason(''); setDeleteSuccess(false); }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              {deleteSuccess ? (
                <div className="text-center py-6">
                  <SuccessIcon className="w-12 h-12 mx-auto mb-3" />
                  <p className="text-lg font-bold text-gray-900">
                    {isAdminUser ? 'Order Deleted' : 'Request Submitted'}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    {isAdminUser
                      ? 'The order has been permanently deleted.'
                      : 'An admin will review and approve the deletion.'}
                  </p>
                  <button onClick={() => router.push('/orders')}
                    className="mt-5 px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
                    Back to Orders
                  </button>
                </div>
              ) : isAdminUser ? (
                <>
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <strong>Warning:</strong> You are about to permanently delete this order. This cannot be undone.
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-sm">
                    <p className="font-medium text-gray-700">Order: {order.orderNumber}</p>
                    <p className="text-gray-500">{order.customer.companyName} · {fmt(total)}</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleDeleteRequest} disabled={requesting}
                      className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
                      {requesting ? 'Deleting...' : 'Delete Order'}
                    </button>
                    <button onClick={() => setShowDeleteModal(false)}
                      className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <strong>Note:</strong> Deleting an order requires admin approval. Your request will be sent to the approvals queue.
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg text-sm">
                    <p className="font-medium text-gray-700">Order: {order.orderNumber}</p>
                    <p className="text-gray-500">{order.customer.companyName} · {fmt(total)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Reason for deletion *</label>
                    <textarea rows={3} value={deleteReason} onChange={e => setDeleteReason(e.target.value)}
                      placeholder="Explain why this order should be deleted..."
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
