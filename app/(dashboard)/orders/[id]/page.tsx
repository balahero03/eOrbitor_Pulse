'use client';

import { useState, useEffect, useRef } from 'react';
import { toFiniteNumber } from '@/lib/money';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { EditIcon, DownloadIcon, CheckGlyph, AttachmentIcon, QuotationIcon, CloseIcon, SuccessIcon, LockIcon, WarningIcon, UploadIcon, PaymentIcon } from '@/components/icons';
import { useNotificationHighlight } from '@/lib/hooks/useNotificationHighlight';
import { highlightRingClass } from '@/lib/notificationHighlight';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { buttonClasses } from '@/components/Button';
import { InlineLoader } from '@/components/BrandedLoader';
import Modal, { ModalHeader, ModalBody, ModalFooter } from '@/components/Modal';
import NumberField from '@/components/NumberField';

/** One row of the order's payment ledger. */
interface OrderPaymentRow {
  id: string;
  amount: string;
  paidAt: string;
  mode?: string | null;
  reference?: string | null;
  remarks?: string | null;
  /** StoredFile descriptor; the bytes are served by the /proof route. */
  proof?: { filename?: string; contentType?: string; size?: number } | null;
  recordedBy: { id: string; firstName: string; lastName: string };
  createdAt: string;
}

interface Order {
  id: string;
  orderNumber: string;
  poNumber?: string;
  status: string;
  paymentStatus: string;
  customer: { id: string; companyName: string };
  quotation?: { id: string; quotationNumber: string; totalAmount?: string };
  deal?: { id: string; dealName: string };
  totalAmount: string;
  amountPaid: string;
  paymentMode?: string;
  paymentRemarks?: string;
  paymentProofUrl?: string;
  poDate?: string;
  deliveryDate?: string;
  invoiceUrl?: string;
  invoiceNumber?: string;
  invoiceFile?: { filename?: string; contentType?: string; size?: number } | null;
  createdAt: string;
}

// ─── Shared form styling ──────────────────────────────────────────────────────
// The two modals on this page had drifted into slightly different input class
// strings. Naming them once keeps every field the same height, radius and
// focus treatment, and makes the focus ring strong enough to actually see.
const FIELD =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 ' +
  'transition-shadow focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

const LABEL = 'block text-sm font-medium text-gray-700 mb-1.5';

/** Section heading inside a modal: small caps label with a hairline rule. */
function FieldGroup({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{title}</h3>
        <span className="h-px bg-gray-100 flex-1" />
        {aside}
      </div>
      {children}
    </section>
  );
}

const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'FULFILLED', 'INVOICED', 'COMPLETED'];

const PAYMENT_MODES = ['Bank Transfer', 'Cheque', 'Cash', 'UPI', 'NEFT', 'RTGS', 'DD', 'Credit Card', 'Other'];

const fmt = (v: string | number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(toFiniteNumber(v));

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
  const toast = useToast();
  const confirm = useConfirm();
  // Deep-linked from an order notification — rings the order's main card.
  const orderFlashId = useNotificationHighlight('order');
  const fileRef = useRef<HTMLInputElement>(null);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit modal
  const [showEdit, setShowEdit] = useState(false);
  const [editData, setEditData] = useState({
    poNumber: '', poDate: '', totalAmount: '',
    deliveryDate: '', invoiceNumber: '', status: '',
  });
  /** New invoice file chosen in the Edit modal, base64 for the API. */
  const [invoiceUpload, setInvoiceUpload] = useState<{ name: string; dataBase64: string; contentType: string } | null>(null);

  // Payment ledger
  const [payments, setPayments] = useState<OrderPaymentRow[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  // Record Payment can be reached from the page or from inside Edit Order.
  // Knowing which lets the dialog offer a way back instead of being a dead end.
  const [paymentFromEdit, setPaymentFromEdit] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '', paidAt: '', mode: 'UPI', reference: '', remarks: '',
  });
  const [paymentProof, setPaymentProof] = useState<{ name: string; dataBase64: string; contentType: string } | null>(null);
  const paymentFileRef = useRef<HTMLInputElement>(null);

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
      .catch(() => { });
  }, []);

  useEffect(() => { fetchOrder(); fetchPayments(); }, [id]);

  const fetchOrder = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/orders/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setOrder(data);
    } catch { } finally { setLoading(false); }
  };

  const fetchPayments = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/orders/${id}/payments`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const data = await res.json();
      setPayments(data.payments || []);
    } catch { /* the panel just shows empty */ }
  };

  const openPayment = () => {
    if (!order) return;
    const currentTotal = (order.totalAmount && Number(order.totalAmount) > 0)
      ? Number(order.totalAmount)
      : Number(order.quotation?.totalAmount || 0);

    const outstanding = Math.max(currentTotal - parseFloat(order.amountPaid || '0'), 0);
    setPaymentForm({
      // Pre-filled with the outstanding balance — the overwhelmingly common
      // case is "they paid the rest", and it is still fully editable for a
      // part payment. This is the manual re-typing the old Edit flow forced.
      amount: outstanding > 0 ? String(outstanding) : '',
      paidAt: new Date().toISOString().split('T')[0],
      mode: order.paymentMode || 'UPI',
      reference: '',
      remarks: '',
    });
    setPaymentProof(null);
    setShowPayment(true);
  };

  // Edit → Record Payment used to swap both modals in the same tick, so the
  // first vanished as the second appeared and the two read as one flicker.
  // Closing first and opening after the exit animation makes it a hand-off:
  // one panel leaves, the next arrives.
  const handleEditToPayment = () => {
    setPaymentFromEdit(true);
    setShowEdit(false);
    setTimeout(openPayment, 190); // just past the 180ms exit in tailwind.config
  };

  /** Reverse of the hand-off: close Payment, reopen Edit once it has left. */
  const handlePaymentBackToEdit = () => {
    setShowPayment(false);
    setTimeout(() => { setPaymentFromEdit(false); openEdit(); }, 190);
  };

  const handlePaymentFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      // Strip the "data:...;base64," prefix — the server stores raw bytes on
      // disk and wants only the payload.
      const raw = String(reader.result);
      const base64 = raw.includes(',') ? raw.split(',')[1] : raw;
      setPaymentProof({ name: file.name, dataBase64: base64, contentType: file.type || 'application/octet-stream' });
    };
    reader.readAsDataURL(file);
  };

  const submitPayment = async () => {
    setSavingPayment(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/orders/${id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          amount: paymentForm.amount,
          paidAt: paymentForm.paidAt || undefined,
          mode: paymentForm.mode || undefined,
          reference: paymentForm.reference || undefined,
          remarks: paymentForm.remarks || undefined,
          proofFile: paymentProof
            ? { filename: paymentProof.name, contentType: paymentProof.contentType, dataBase64: paymentProof.dataBase64 }
            : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || 'Could not record the payment');
      toast.success('Payment recorded.');
      setShowPayment(false);
      await Promise.all([fetchOrder(), fetchPayments()]);
    } catch (err: any) {
      toast.error(err.message || 'Could not record the payment.');
    } finally {
      setSavingPayment(false);
    }
  };

  const deletePayment = async (paymentId: string) => {
    if (!(await confirm('The order balance will be recalculated without it.', { title: 'Remove this payment?', danger: true }))) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/orders/${id}/payments/${paymentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not remove the payment');
      toast.success('Payment removed.');
      await Promise.all([fetchOrder(), fetchPayments()]);
    } catch (err: any) {
      toast.error(err.message || 'Could not remove the payment.');
    }
  };

  const openEdit = () => {
    if (!order) return;
    const initialTotal = (order.totalAmount && Number(order.totalAmount) > 0)
      ? order.totalAmount
      : (order.quotation?.totalAmount || '0');

    setEditData({
      poNumber: order.poNumber || '',
      poDate: order.poDate ? order.poDate.split('T')[0] : '',
      // Pre-filled from the order or quotation, so the value only needs touching when it is
      // genuinely wrong — never retyped from scratch.
      totalAmount: initialTotal,
      deliveryDate: order.deliveryDate ? order.deliveryDate.split('T')[0] : '',
      invoiceNumber: order.invoiceNumber || '',
      status: order.status,
    });
    setInvoiceUpload(null);
    setShowEdit(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('File must be under 5 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result);
      setInvoiceUpload({
        name: file.name,
        dataBase64: raw.includes(',') ? raw.split(',')[1] : raw,
        contentType: file.type || 'application/octet-stream',
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          poNumber: editData.poNumber,
          poDate: editData.poDate || null,
          totalAmount: editData.totalAmount,
          deliveryDate: editData.deliveryDate || undefined,
          invoiceNumber: editData.invoiceNumber,
          // Only sent when a new file was picked, so saving the form doesn't
          // clear an invoice already on file.
          invoiceFile: invoiceUpload
            ? { filename: invoiceUpload.name, contentType: invoiceUpload.contentType, dataBase64: invoiceUpload.dataBase64 }
            : undefined,
          // amountPaid is intentionally absent — the payment ledger owns it.
          ...(isAdminUser && editData.status !== order?.status ? { status: editData.status } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data.message || 'Failed to save'); return; }
      setOrder(data);
      setShowEdit(false);
      await fetchPayments();
      toast.success('Order updated.');
    } catch { toast.error('An error occurred'); }
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
          toast.error(e.message || 'Failed to delete order');
        }
      } else {
        // Non-admins submit an approval request.
        if (!deleteReason.trim()) { toast.error('Please enter a reason'); setRequesting(false); return; }
        const res = await fetch('/api/approval-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ entityId: id, type: 'ORDER_DELETE', reason: deleteReason }),
        });
        if (res.ok) { setDeleteSuccess(true); }
        else { const e = await res.json(); toast.error(e.message || 'Failed to submit request'); }
      }
    } catch { toast.error('An error occurred'); }
    finally { setRequesting(false); }
  };

  if (loading) return <InlineLoader message="Loading order…" />;
  if (!order) return <div className="p-6 text-center text-gray-500">Order not found</div>;

  const total = parseFloat(order.totalAmount);
  const paid = parseFloat(order.amountPaid);
  const balance = total - paid;
  // Balance implied by whatever is currently typed in the Edit modal, which is
  // not the same as the saved order's balance while the value is being edited.
  const editBalance = (parseFloat(editData.totalAmount || '0') || 0) - paid;

  // Nothing to save until something actually changed — an always-enabled Save
  // invites a pointless round trip and makes it unclear whether an edit
  // registered at all.
  const editDirty = !!order && (
    (editData.poNumber || '') !== (order.poNumber || '') ||
    editData.poDate !== (order.poDate ? order.poDate.split('T')[0] : '') ||
    String(editData.totalAmount) !== String(order.totalAmount) ||
    editData.deliveryDate !== (order.deliveryDate ? order.deliveryDate.split('T')[0] : '') ||
    (editData.invoiceNumber || '') !== (order.invoiceNumber || '') ||
    editData.status !== order.status ||
    !!invoiceUpload
  );
  const paidPct = Math.min((paid / total) * 100, 100);

  return (
    <div className="p-3 sm:p-6 space-y-3 sm:space-y-5">
      {/* Header — a card like every other detail page, carrying the two states
          that actually matter (fulfilment and payment) so they are readable
          without scrolling into the panels below. */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-4 flex items-start sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-mono truncate">{order.orderNumber}</h1>
            {/* Two unlabelled badges reading "PENDING" and "PARTIAL" looked
                contradictory — nothing said one meant fulfilment and the other
                money. The first is labelled, and the second states the
                outstanding amount instead of repeating a status word that
                collides with it (and that the sidebar already shows). */}
            <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold whitespace-nowrap ${statusColor[order.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
              <span className="opacity-60 font-medium">Order</span> {order.status}
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold whitespace-nowrap ${
              balance > 0 ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-green-50 text-green-800 border-green-200'
            }`}>
              {balance > 0 ? <>{fmt(balance)} <span className="opacity-70 font-medium">due</span></> : 'Paid in full'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5 truncate">{order.customer?.companyName ?? '—'}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          {(order.deal?.id || (order as any).dealId) && (
            <Link
              href={`/leads/${order.deal?.id || (order as any).dealId}`}
              className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold border border-blue-200 transition-colors inline-flex items-center gap-1.5"
            >
              <span>View Lead ({order.deal?.dealName || 'Corresponding Lead'})</span>
              <span className="text-xs">↗</span>
            </Link>
          )}
          {order.quotation?.id && (
            <Link
              href={`/quotations/${order.quotation.id}`}
              className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold border border-indigo-200 transition-colors inline-flex items-center gap-1.5"
            >
              <span>Quotation ({order.quotation.quotationNumber})</span>
              <span className="text-xs">↗</span>
            </Link>
          )}
          {order.customer?.id && (
            <Link
              href={`/customers/${order.customer.id}`}
              className="px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-xs font-semibold border border-purple-200 transition-colors inline-flex items-center gap-1.5"
            >
              <span>View Customer</span>
              <span className="text-xs">↗</span>
            </Link>
          )}
          <button onClick={openEdit} className={buttonClasses({ size: 'sm' })}>
            <EditIcon className="w-4 h-4" /> Edit
          </button>
          <Link href="/orders" className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'whitespace-nowrap' })}>
            ← <span className="hidden xs:inline">Orders</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-4">

          {/* Info */}
          <div id={`order-${id}`} className={`bg-white rounded-xl border border-gray-200 shadow-sm p-3.5 sm:p-6 ${highlightRingClass(orderFlashId === id)}`}>
            {/* Customer and Order Status moved to the page header, where they
                belong — repeating them here just pushed the real detail down. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">Customer</p>
                {order.customer ? (
                  <Link href={`/customers/${order.customer.id}`} className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 transition-colors">
                    <span>{order.customer.companyName}</span>
                    <span className="text-xs">↗</span>
                  </Link>
                ) : (
                  <p className="text-sm font-semibold text-gray-900 break-words">—</p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">Corresponding Lead / Deal</p>
                {order.deal ? (
                  <Link href={`/leads/${order.deal.id}`} className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 transition-colors">
                    <span>{order.deal.dealName}</span>
                    <span className="text-xs">↗</span>
                  </Link>
                ) : (order as any).dealId ? (
                  <Link href={`/leads/${(order as any).dealId}`} className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 transition-colors">
                    <span>View Corresponding Lead</span>
                    <span className="text-xs">↗</span>
                  </Link>
                ) : (
                  <p className="text-sm text-gray-400">—</p>
                )}
              </div>
              {order.quotation && (
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">Quotation</p>
                  <Link href={`/quotations/${order.quotation?.id}`} className="text-blue-600 hover:text-blue-800 hover:underline font-semibold text-sm inline-flex items-center gap-1 transition-colors">
                    <span>{order.quotation?.quotationNumber}</span>
                    <span className="text-xs">↗</span>
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
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3.5 sm:p-6">
            <h2 className="text-base font-bold text-gray-900 mb-4">Order Documents</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">PO Number</p>
                <p className="text-sm font-medium text-gray-900">{order.poNumber || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">PO Date</p>
                <p className="text-sm font-medium text-gray-900">{fmtDate(order.poDate)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">Delivery Date</p>
                <p className="text-sm font-medium text-gray-900">{fmtDate(order.deliveryDate)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">Invoice</p>
                {order.invoiceNumber || order.invoiceFile ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 font-mono break-all">
                      {order.invoiceNumber || '—'}
                    </span>
                    {order.invoiceFile && (
                      <a href={`/api/orders/${id}/invoice`} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline whitespace-nowrap">
                        <AttachmentIcon className="w-3.5 h-3.5" /> View
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">—</p>
                )}
              </div>
            </div>
          </div>

          {/* Amount */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3.5 sm:p-6">
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

          {/* ── Payment History ────────────────────────────────────────────
              Replaces the old single "Payment Details" block, which could only
              ever show the most recent payment's mode/remarks/proof because
              the order held exactly one of each. Every receipt is now its own
              row, so a part-paid order can be reconciled line by line. */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3.5 sm:p-6">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="text-base font-bold text-gray-900">Payment History</h2>
              {balance > 0 && (
                <button onClick={openPayment} className={buttonClasses({ size: 'sm' })}>
                  + Record Payment
                </button>
              )}
            </div>

            {payments.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">No payments recorded yet</p>
                {balance > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    {fmt(balance)} outstanding on this order.
                  </p>
                )}
              </div>
            ) : (
              <ol className="space-y-2.5">
                {payments.map(p => (
                  <li key={p.id} className="rounded-xl border border-gray-200 p-3 hover:border-gray-300 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-bold text-green-700 tabular-nums">{fmt(p.amount)}</span>
                          {p.mode && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200 font-semibold uppercase tracking-wide">
                              {p.mode}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {fmtDate(p.paidAt)}
                          {' · '}
                          <span className="text-gray-400">
                            recorded by {p.recordedBy.firstName} {p.recordedBy.lastName}
                          </span>
                        </p>
                        {/* The reference is the field you match against a bank
                            statement, so it gets monospace and its own line. */}
                        {p.reference && (
                          <p className="text-xs mt-1">
                            <span className="text-gray-400">Ref </span>
                            <span className="font-mono font-medium text-gray-700 break-all">{p.reference}</span>
                          </p>
                        )}
                        {p.remarks && (
                          <p className="text-xs text-gray-600 mt-1 break-words">{p.remarks}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {p.proof && (
                          <a
                            href={`/api/orders/${id}/payments/${p.id}/proof`}
                            target="_blank"
                            rel="noreferrer"
                            title={(p.proof as any).filename || 'Receipt'}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline whitespace-nowrap"
                          >
                            <AttachmentIcon className="w-3.5 h-3.5" /> Receipt
                          </a>
                        )}
                        {isAdminUser && (
                          <button
                            onClick={() => deletePayment(p.id)}
                            title="Remove this payment"
                            className="text-gray-300 hover:text-red-500 text-lg leading-none px-1"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">

          {/* Payment Status */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3.5 sm:p-6">
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
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3.5 sm:p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Actions</h3>
            <div className="space-y-2">
              {order.status === 'PENDING' && (
                <button onClick={handleConfirm} disabled={saving}
                  className={buttonClasses({ fullWidth: true })}>
                  {saving ? 'Processing...' : 'Confirm Order'}
                </button>
              )}
              {order.status === 'CONFIRMED' && (
                <button onClick={handleFulfill} disabled={saving}
                  className={buttonClasses({ variant: 'success', fullWidth: true })}>
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
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3.5 sm:p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-4">Order Timeline</h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2">
                <CheckGlyph className="w-4 h-4 mt-0.5" color="text-blue-600" />
                <div><p className="font-medium text-gray-900">Order Created</p><p className="text-gray-400">{fmtDate(order.createdAt)}</p></div>
              </div>
              {order.status !== 'PENDING' && (
                <div className="flex items-start gap-2">
                  <CheckGlyph className="w-4 h-4 mt-0.5" color="text-blue-600" />
                  <div><p className="font-medium text-gray-900">Confirmed</p><p className="text-gray-400">—</p></div>
                </div>
              )}
              {order.status === 'FULFILLED' && (
                <div className="flex items-start gap-2">
                  <CheckGlyph className="w-4 h-4 mt-0.5" color="text-green-600" />
                  <div><p className="font-medium text-gray-900">Fulfilled</p><p className="text-gray-400">{fmtDate(order.deliveryDate)}</p></div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Edit Modal ─────────────────────────────────────────────── */}
      <Modal open={showPayment && !!order} onClose={() => setShowPayment(false)} size="lg">
        {order && (
          <>
            <ModalHeader
              title="Record Payment"
              subtitle={order.orderNumber}
              onClose={() => setShowPayment(false)}
              onBack={paymentFromEdit ? handlePaymentBackToEdit : undefined}
              backLabel="Back to Edit Order"
              accent="success"
              icon={<PaymentIcon className="w-5 h-5" color="text-green-600" />}
            />

            <ModalBody className="space-y-4">
              {/* The three figures you need before deciding what to type, shown
                  where you are typing it — rather than behind the modal. These
                  recalculate from the ledger after every instalment, so the
                  outstanding figure is always current. */}
              <div className="grid grid-cols-3 gap-2 rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 p-3 text-center">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Order Value</p>
                  <p className="text-sm sm:text-base font-bold text-gray-900 mt-1 tabular-nums">{fmt(total)}</p>
                </div>
                <div className="bg-green-50 p-3 text-center">
                  <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wider">Collected</p>
                  <p className="text-sm sm:text-base font-bold text-green-700 mt-1 tabular-nums">{fmt(paid)}</p>
                </div>
                <div className={`p-3 text-center ${balance > 0 ? 'bg-amber-50' : 'bg-emerald-50'}`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-wider ${balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    Outstanding
                  </p>
                  <p className={`text-sm sm:text-base font-bold mt-1 tabular-nums ${balance > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {fmt(balance)}
                  </p>
                </div>
              </div>
              {payments.length > 0 && (
                <p className="text-xs text-gray-400 -mt-1">
                  {payments.length} payment{payments.length > 1 ? 's' : ''} already recorded against this order.
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Amount received *</label>
                  <NumberField prefix="₹" value={paymentForm.amount}
                    onChange={v => setPaymentForm(p => ({ ...p, amount: v }))}
                    min="0" step="0.01" placeholder="0" />
                  {Number.isFinite(parseFloat(paymentForm.amount)) && paymentForm.amount !== '' && (
                    <p className="text-xs font-semibold text-gray-600 tabular-nums mt-1.5">{fmt(paymentForm.amount)}</p>
                  )}
                  {/* Quick Preset Buttons for Phase Payments (50%, 25%, Full Balance) */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {total > 0 && (
                      <>
                        <button type="button"
                          onClick={() => setPaymentForm(p => ({ ...p, amount: (total * 0.5).toFixed(2) }))}
                          className="text-[11px] px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-md font-semibold transition-colors">
                          50% Phase ({fmt(total * 0.5)})
                        </button>
                        <button type="button"
                          onClick={() => setPaymentForm(p => ({ ...p, amount: (total * 0.25).toFixed(2) }))}
                          className="text-[11px] px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-md font-semibold transition-colors">
                          25% Phase ({fmt(total * 0.25)})
                        </button>
                      </>
                    )}
                    {parseFloat(paymentForm.amount || '0') > balance && balance > 0 && (
                      <p className="text-xs text-red-600 mt-1.5 inline-flex items-start gap-1 animate-slide-up">
                        <WarningIcon className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                        <span>More than the {fmt(balance)} outstanding — the server will reject this.</span>
                      </p>
                    )}
                    {balance > 0 && String(balance) !== paymentForm.amount && (
                      <button type="button"
                        onClick={() => setPaymentForm(p => ({ ...p, amount: String(balance) }))}
                        className={buttonClasses({ variant: 'success', size: 'xs' })}>
                        Full Balance ({fmt(balance)})
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className={LABEL}>Date received *</label>
                  <input type="date" value={paymentForm.paidAt}
                    onChange={e => setPaymentForm(p => ({ ...p, paidAt: e.target.value }))}
                    max={new Date().toISOString().split('T')[0]}
                    className={FIELD} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Mode</label>
                  <select value={paymentForm.mode}
                    onChange={e => setPaymentForm(p => ({ ...p, mode: e.target.value }))}
                    className={FIELD}>
                    {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Reference</label>
                  <input type="text" value={paymentForm.reference}
                    onChange={e => setPaymentForm(p => ({ ...p, reference: e.target.value }))}
                    placeholder="UTR / UPI ref / cheque no."
                    className={FIELD} />
                  <p className="text-xs text-gray-400 mt-1">What you&apos;ll match against the bank statement.</p>
                </div>
              </div>

              <div>
                <label className={LABEL}>Receipt / proof</label>
                <div onClick={() => paymentFileRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  {paymentProof ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-green-700">
                      <AttachmentIcon className="w-4 h-4" />
                      <span className="font-medium truncate max-w-[220px]">{paymentProof.name}</span>
                      <button type="button"
                        onClick={e => { e.stopPropagation(); setPaymentProof(null); if (paymentFileRef.current) paymentFileRef.current.value = ''; }}
                        className="ml-1 text-red-500 hover:text-red-700"><CloseIcon className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <div className="text-gray-500 text-sm flex flex-col items-center">
                      <p className="flex items-center gap-1.5"><QuotationIcon className="w-4 h-4" color="text-gray-400" /> Click to attach a receipt</p>
                      <p className="text-xs text-gray-400 mt-0.5">Image or PDF — stored on the server, not in the database</p>
                    </div>
                  )}
                </div>
                <input ref={paymentFileRef} type="file" accept="image/*,application/pdf"
                  onChange={handlePaymentFile} className="hidden" />
              </div>

              <div>
                <label className={LABEL}>Remarks</label>
                <textarea rows={2} value={paymentForm.remarks}
                  onChange={e => setPaymentForm(p => ({ ...p, remarks: e.target.value }))}
                  placeholder="Anything worth noting about this payment…"
                  className={FIELD} />
              </div>
            </ModalBody>

            <ModalFooter hint={balance > 0 ? `${fmt(balance)} outstanding` : 'Fully paid'}>
              <button onClick={() => setShowPayment(false)} disabled={savingPayment}
                className={buttonClasses({ variant: 'secondary', size: 'lg', className: 'w-full sm:w-auto' })}>
                Cancel
              </button>
              {/* Mirrors the server's overpayment rule so the failure is visible
                  before submitting rather than as an error toast after. */}
              <button onClick={submitPayment}
                disabled={savingPayment || !paymentForm.amount || parseFloat(paymentForm.amount || '0') <= 0 || (balance > 0 && parseFloat(paymentForm.amount || '0') > balance)}
                className={buttonClasses({ size: 'lg', className: 'w-full sm:w-auto' })}>
                {savingPayment ? 'Recording…' : 'Record Payment'}
              </button>
            </ModalFooter>
          </>
        )}
      </Modal>

      <Modal open={showEdit} onClose={() => setShowEdit(false)} size="lg">
        <ModalHeader
          title="Edit Order"
          subtitle={<span className="font-mono">{order.orderNumber}</span>}
          onClose={() => setShowEdit(false)}
          icon={<EditIcon className="w-[18px] h-[18px]" color="text-gray-500" />}
        />
        <ModalBody className="space-y-6">

              <FieldGroup title="PO Details">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL}>PO Number</label>
                    <input type="text" value={editData.poNumber}
                      onChange={e => setEditData(p => ({ ...p, poNumber: e.target.value }))}
                      placeholder="Customer PO #" className={FIELD} />
                  </div>
                  <div>
                    <label className={LABEL}>PO Date</label>
                    <input type="date" value={editData.poDate}
                      onChange={e => setEditData(p => ({ ...p, poDate: e.target.value }))}
                      className={FIELD} />
                  </div>
                </div>
              </FieldGroup>

              <FieldGroup
                title="Order Value"
                aside={order.quotation?.quotationNumber ? (
                  <Link href={`/quotations/${order.quotation.id}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors whitespace-nowrap">
                    <LockIcon className="w-3 h-3" /> {order.quotation.quotationNumber}
                  </Link>
                ) : undefined}
              >
                <div>
                  <label className={LABEL}>Total Amount</label>
                  <NumberField prefix="₹" value={editData.totalAmount}
                    onChange={v => setEditData(p => ({ ...p, totalAmount: v }))}
                    min="0" step="0.01" placeholder="0" />
                  {/* A seven-digit number is unreadable as raw digits, so the
                      grouped value is echoed under the field as you type. */}
                  <div className="flex items-start justify-between gap-2 mt-1.5">
                    <p className="text-xs text-gray-400">
                      {order.quotation?.quotationNumber
                        ? <>From accepted quotation <span className="font-mono text-gray-600">{order.quotation.quotationNumber}</span>.</>
                        : 'No quotation linked — value entered manually.'}
                    </p>
                    {Number.isFinite(parseFloat(editData.totalAmount)) && editData.totalAmount !== '' && (
                      <span className="text-xs font-semibold text-gray-600 tabular-nums whitespace-nowrap">
                        {fmt(editData.totalAmount)}
                      </span>
                    )}
                  </div>
                </div>

                {editData.totalAmount && (
                  <div className="animate-slide-up">
                    <div className="grid grid-cols-3 rounded-xl border border-gray-200 overflow-hidden divide-x divide-gray-200">
                      <div className="bg-gray-50 p-2.5 text-center">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total</p>
                        <p className="text-sm font-bold text-gray-900 mt-0.5 tabular-nums">{fmt(editData.totalAmount)}</p>
                      </div>
                      <div className="bg-green-50 p-2.5 text-center">
                        <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Paid</p>
                        <p className="text-sm font-bold text-green-700 mt-0.5 tabular-nums">{fmt(paid)}</p>
                      </div>
                      {/* transition-colors so the red↔green flip when the value
                          crosses the paid amount reads as a change, not a jump */}
                      <div className={`p-2.5 text-center transition-colors duration-300 ${editBalance > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
                        <p className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${editBalance > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                          Balance
                        </p>
                        <p className={`text-sm font-bold mt-0.5 tabular-nums transition-colors ${editBalance > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                          {fmt(editBalance)}
                        </p>
                      </div>
                    </div>

                    {editBalance > 0 && (
                      <button type="button"
                        onClick={handleEditToPayment}
                        className={buttonClasses({ variant: 'success', size: 'lg', fullWidth: true, className: 'mt-2.5' })}>
                        <PaymentIcon className="w-4 h-4" color="text-white" /> Record Payment for this Order
                      </button>
                    )}
                  </div>
                )}
              </FieldGroup>

              <FieldGroup title="Delivery & Invoice">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL}>Delivery Date</label>
                    <input type="date" value={editData.deliveryDate}
                      onChange={e => setEditData(p => ({ ...p, deliveryDate: e.target.value }))}
                      className={FIELD} />
                  </div>
                  <div>
                    <label className={LABEL}>Invoice Number</label>
                    <input type="text" value={editData.invoiceNumber}
                      onChange={e => setEditData(p => ({ ...p, invoiceNumber: e.target.value }))}
                      placeholder="e.g. INV-2026-0042" className={FIELD} />
                  </div>
                </div>
                <div>
                  <label className={LABEL}>Invoice File</label>
                  <div onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-3.5 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/60 transition-colors">
                    {invoiceUpload ? (
                      <div className="flex items-center justify-center gap-2 text-sm text-green-700">
                        <AttachmentIcon className="w-4 h-4 flex-shrink-0" />
                        <span className="font-medium truncate max-w-[200px]">{invoiceUpload.name}</span>
                        <button type="button"
                          onClick={e => { e.stopPropagation(); setInvoiceUpload(null); if (fileRef.current) fileRef.current.value = ''; }}
                          className="ml-1 text-gray-400 hover:text-red-600 transition-colors"><CloseIcon className="w-4 h-4" /></button>
                      </div>
                    ) : order.invoiceFile ? (
                      <div className="flex items-center justify-center gap-2 text-sm flex-wrap">
                        <AttachmentIcon className="w-4 h-4" color="text-gray-400" />
                        <span className="text-gray-700 font-medium">{(order.invoiceFile as any).filename || 'Invoice on file'}</span>
                        <span className="text-xs text-gray-400">— click to replace</span>
                      </div>
                    ) : (
                      <div className="text-gray-500 text-sm flex flex-col items-center gap-0.5">
                        <p className="flex items-center gap-1.5"><UploadIcon className="w-4 h-4" /> Click to attach the invoice</p>
                        <p className="text-xs text-gray-400">PDF or image — stored on the server</p>
                      </div>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={handleFileChange} className="hidden" />
                </div>
              </FieldGroup>

              {isAdminUser && (
                <FieldGroup title="Order Status">
                  <div>
                    <select value={editData.status}
                      onChange={e => setEditData(p => ({ ...p, status: e.target.value }))}
                      className={FIELD}>
                      {ORDER_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                    </select>
                    {editData.status !== order.status && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2 inline-flex items-start gap-1.5 animate-slide-up">
                        <WarningIcon className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                        <span>Admin override — skips the Confirm / Fulfil checks.</span>
                      </p>
                    )}
                  </div>
                </FieldGroup>
              )}

              {/* Payment entry deliberately lives in Record Payment, not here.
                  Editing an order used to be the only way to attach a mode or
                  a receipt, which meant correcting a PO number and recording
                  money were the same action — and each new payment silently
                  overwrote the previous one's details. */}
              <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
                To record money received, close this and use <span className="font-semibold text-gray-700">Record Payment</span> —
                each payment is kept as its own entry with its date, reference and receipt.
              </p>
        </ModalBody>
        <ModalFooter hint={editDirty ? 'Unsaved changes' : 'No changes yet'}>
          <button onClick={() => setShowEdit(false)} disabled={saving}
            className={buttonClasses({ variant: 'secondary', size: 'lg', className: 'w-full sm:w-auto' })}>
            Cancel
          </button>
          <button onClick={handleSaveEdit} disabled={saving || !editDirty}
            className={buttonClasses({ size: 'lg', className: 'w-full sm:w-auto' })}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </ModalFooter>
      </Modal>

      {/* ── Delete Modal ──────────────────────────────────── */}
      <Modal
        open={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteReason(''); setDeleteSuccess(false); }}
        size="md"
      >
        <ModalHeader
          title={isAdminUser ? 'Delete Order' : 'Request Order Deletion'}
          onClose={() => { setShowDeleteModal(false); setDeleteReason(''); setDeleteSuccess(false); }}
        />
        <ModalBody className="space-y-4">
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
                    className={buttonClasses({ className: 'mt-5' })}>
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
                    <p className="text-gray-500">{order.customer?.companyName ?? '—'} · {fmt(total)}</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleDeleteRequest} disabled={requesting}
                      className={buttonClasses({ variant: 'danger', size: 'lg', className: 'flex-1' })}>
                      {requesting ? 'Deleting...' : 'Delete Order'}
                    </button>
                    <button onClick={() => setShowDeleteModal(false)}
                      className={buttonClasses({ variant: 'secondary', size: 'lg', className: 'flex-1' })}>
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
                    <p className="text-gray-500">{order.customer?.companyName ?? '—'} · {fmt(total)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Reason for deletion *</label>
                    <textarea rows={3} value={deleteReason} onChange={e => setDeleteReason(e.target.value)}
                      placeholder="Explain why this order should be deleted..."
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleDeleteRequest} disabled={requesting || !deleteReason.trim()}
                      className={buttonClasses({ variant: 'danger', size: 'lg', className: 'flex-1' })}>
                      {requesting ? 'Submitting...' : 'Submit Request'}
                    </button>
                    <button onClick={() => setShowDeleteModal(false)}
                      className={buttonClasses({ variant: 'secondary', size: 'lg', className: 'flex-1' })}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
        </ModalBody>
      </Modal>
    </div>
  );
}
