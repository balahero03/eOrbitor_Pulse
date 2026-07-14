'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRequireRole } from '@/lib/hooks/useRequireRole';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { useNotificationHighlight } from '@/lib/hooks/useNotificationHighlight';
import { highlightRingClass, HIGHLIGHT_EVENT, readPendingHighlight, HighlightRequest } from '@/lib/notificationHighlight';
import { SuccessIcon, ErrorIcon, PendingIcon, UserSingleIcon, ClipboardIcon, CheckGlyph, CloseIcon, LockIcon } from '@/components/icons';

type Status = 'PENDING' | 'APPROVED' | 'REJECTED';
type Category = 'record' | 'access';

// Record approvals — lead/order/customer delete/reopen requests.
interface RecordRequest {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  status: Status;
  reason?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  requestedByUser: { id: string; firstName: string; lastName: string; email: string };
  approvedByUser?: { id: string; firstName: string; lastName: string };
  lead?: { id: string; name: string; company: string; status: string };
}

// After-hours access requests.
interface AccessRequest {
  id: string;
  date: string;
  reason?: string;
  status: Status;
  rejectionReason?: string;
  reviewedAt?: string;
  createdAt: string;
  user?: { id: string; firstName: string; lastName: string; email: string; role: string };
}

const STATUS_TABS: { key: Status; label: string }[] = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
];

const TYPE_LABEL: Record<string, string> = {
  LEAD_DELETE: 'Delete Lead',
  LEAD_REOPEN: 'Reopen Lead',
  ORDER_DELETE: 'Delete Order',
  CUSTOMER_DELETE: 'Delete Customer',
};

const PAGE_SIZE = 15;

function fmtDateTime(s: string) {
  return new Date(s).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ApprovalsPage() {
  useRequireRole(['SUPER_ADMIN', 'ADMIN', 'BACKEND_TEAM']);
  const { user } = useCurrentUser();
  // Only admins can decide after-hours access requests (the API gates that),
  // and the request list is admin-scoped — so the Access category is admin-only.
  const canReviewAccess = !!user && ['SUPER_ADMIN', 'ADMIN'].includes(user.role);

  const [category, setCategory] = useState<Category>('record');
  const [tab, setTab] = useState<Status>('PENDING');

  // Highlight rings — record requests keyed by their entity id (what the
  // notification carries), access requests keyed by their own id.
  const flashRecordId = useNotificationHighlight('approval');
  const flashAccessId = useNotificationHighlight('access');

  // Jump to the right category on mount / when a notification fires, so the
  // deep-linked row is actually rendered for the ring to land on.
  useEffect(() => {
    if (!canReviewAccess) return; // no access category to switch to
    const pendingAccess = readPendingHighlight('access');
    const pendingRecord = readPendingHighlight('approval');
    if (pendingAccess) { setCategory('access'); setTab('PENDING'); }
    else if (pendingRecord) { setCategory('record'); setTab('PENDING'); }

    const handler = (e: Event) => {
      const scope = (e as CustomEvent<HighlightRequest>).detail?.scope;
      if (scope === 'access') { setCategory('access'); setTab('PENDING'); }
      else if (scope === 'approval') { setCategory('record'); setTab('PENDING'); }
    };
    window.addEventListener(HIGHLIGHT_EVENT, handler);
    return () => window.removeEventListener(HIGHLIGHT_EVENT, handler);
  }, [canReviewAccess]);

  const activeCategory = canReviewAccess ? category : 'record';

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Approvals</h1>

      {/* Category switch — only admins get the after-hours access category. */}
      {canReviewAccess && (
        <CategoryBar category={activeCategory} onChange={(c) => { setCategory(c); setTab('PENDING'); }} />
      )}

      {/* Status sub-tabs live inside each category so counts stay accurate. */}
      {activeCategory === 'record' ? (
        <RecordApprovals tab={tab} setTab={setTab} flashId={flashRecordId} />
      ) : (
        <AccessApprovals tab={tab} setTab={setTab} flashId={flashAccessId} />
      )}
    </div>
  );
}

// ── Category bar ────────────────────────────────────────────────────────────
function CategoryBar({ category, onChange }: { category: Category; onChange: (c: Category) => void }) {
  const [pending, setPending] = useState<{ record: number | null; access: number | null }>({ record: null, access: null });

  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  const load = useCallback(async () => {
    try {
      const [rec, acc] = await Promise.all([
        fetch('/api/approval-requests?status=PENDING&limit=1', { headers: authHeaders() }).then((r) => (r.ok ? r.json() : null)),
        fetch('/api/access-requests?status=PENDING', { headers: authHeaders() }).then((r) => (r.ok ? r.json() : null)),
      ]);
      setPending({
        record: rec?.pagination?.total ?? 0,
        access: acc?.requests?.length ?? 0,
      });
    } catch { /* non-critical */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const items: { key: Category; label: string; icon: any; count: number | null }[] = [
    { key: 'record', label: 'Record Requests', icon: ClipboardIcon, count: pending.record },
    { key: 'access', label: 'Access Requests', icon: LockIcon, count: pending.access },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => {
        const active = category === it.key;
        const Icon = it.icon;
        return (
          <button
            key={it.key}
            onClick={() => onChange(it.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
              active ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {it.label}
            {it.count !== null && it.count > 0 && (
              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-white text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                {it.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Shared bits ─────────────────────────────────────────────────────────────
function StatusTabs({ tab, setTab, counts }: { tab: Status; setTab: (s: Status) => void; counts: Record<Status, number | null> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {STATUS_TABS.map((t) => {
        const active = tab === t.key;
        const count = counts[t.key];
        return (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-700'
            }`}
          >
            {t.label}
            {count !== null && (
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${active ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'}`}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  if (status === 'PENDING')
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><PendingIcon className="w-3 h-3" /> Pending</span>;
  if (status === 'APPROVED')
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700"><SuccessIcon className="w-3 h-3" color="text-green-600" /> Approved</span>;
  return <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700"><ErrorIcon className="w-3 h-3" color="text-red-600" /> Rejected</span>;
}

function EmptyState({ tab }: { tab: Status }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
      <ClipboardIcon className="w-9 h-9 mx-auto mb-2 text-gray-300" />
      <p className="text-gray-500">No {tab.toLowerCase()} requests</p>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function cardBorder(status: Status) {
  return status === 'PENDING' ? 'border-l-amber-500' : status === 'APPROVED' ? 'border-l-green-500' : 'border-l-red-500';
}

// ── Record approvals ────────────────────────────────────────────────────────
function RecordApprovals({ tab, setTab, flashId }: { tab: Status; setTab: (s: Status) => void; flashId: string | null }) {
  const [requests, setRequests] = useState<RecordRequest[]>([]);
  const [counts, setCounts] = useState<Record<Status, number | null>>({ PENDING: null, APPROVED: null, REJECTED: null });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState<string | null>(null);

  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  const fetchCounts = useCallback(async () => {
    try {
      const results = await Promise.all(
        (['PENDING', 'APPROVED', 'REJECTED'] as Status[]).map((s) =>
          fetch(`/api/approval-requests?status=${s}&limit=1`, { headers: authHeaders() }).then((r) => (r.ok ? r.json() : { pagination: { total: 0 } }))
        )
      );
      setCounts({ PENDING: results[0].pagination.total, APPROVED: results[1].pagination.total, REJECTED: results[2].pagination.total });
    } catch { /* non-critical */ }
  }, []);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/approval-requests?status=${tab}&page=${page}&limit=${PAGE_SIZE}`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setRequests(data.requests);
      setTotalPages(data.pagination?.pages || 1);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [tab, page]);

  useEffect(() => { setPage(1); }, [tab]);
  useEffect(() => { fetchRequests(); }, [fetchRequests]);
  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  const decide = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/approval-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(status === 'REJECTED' ? { status, rejectionReason } : { status }),
      });
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== id));
        setShowRejectForm(null);
        setRejectionReason('');
        fetchCounts();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Failed to ${status === 'APPROVED' ? 'approve' : 'reject'}: ${err.error || err.message || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message || 'Failed to process request'}`);
    } finally { setProcessingId(null); }
  };

  return (
    <div className="space-y-4">
      <StatusTabs tab={tab} setTab={setTab} counts={counts} />
      {loading ? <Spinner /> : requests.length === 0 ? <EmptyState tab={tab} /> : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} id={`approval-${req.entityId}`} className={`bg-white rounded-xl border border-gray-200 border-l-4 ${cardBorder(req.status)} shadow-sm p-4 ${highlightRingClass(flashId === req.entityId)}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <h3 className="font-semibold text-gray-900">{TYPE_LABEL[req.type] || 'Approval Request'}</h3>
                    <StatusPill status={req.status} />
                  </div>
                  {req.lead ? (
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">{req.lead.name}</span>
                      <span className="text-gray-400"> · {req.lead.company}</span>
                      <span className="text-gray-400"> · {req.lead.status}</span>
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500">{req.entityType} · {req.entityId.slice(0, 10)}…</p>
                  )}
                  <div className="mt-2 space-y-1 text-xs text-gray-500">
                    <p className="flex items-center gap-1.5">
                      <UserSingleIcon className="w-3.5 h-3.5" />
                      Requested by <span className="font-medium text-gray-700">{req.requestedByUser.firstName} {req.requestedByUser.lastName}</span>
                      <span className="text-gray-400">· {fmtDateTime(req.createdAt)}</span>
                    </p>
                    {req.reason && <p><span className="font-medium text-gray-600">Reason:</span> {req.reason}</p>}
                    {req.status === 'APPROVED' && req.approvedByUser && (
                      <p className="flex items-center gap-1.5 text-green-700">
                        <CheckGlyph className="w-3.5 h-3.5" />
                        Approved by <span className="font-medium">{req.approvedByUser.firstName} {req.approvedByUser.lastName}</span>
                        <span className="text-green-600/70">· {fmtDateTime(req.updatedAt)}</span>
                      </p>
                    )}
                    {req.status === 'REJECTED' && (
                      <>
                        {req.approvedByUser && (
                          <p className="flex items-center gap-1.5 text-red-600">
                            <CloseIcon className="w-3.5 h-3.5" />
                            Rejected by <span className="font-medium">{req.approvedByUser.firstName} {req.approvedByUser.lastName}</span>
                            <span className="text-red-500/70">· {fmtDateTime(req.updatedAt)}</span>
                          </p>
                        )}
                        {req.rejectionReason && <p className="text-red-600"><span className="font-medium">Rejection reason:</span> {req.rejectionReason}</p>}
                      </>
                    )}
                  </div>
                </div>
                {req.status === 'PENDING' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => decide(req.id, 'APPROVED')} disabled={processingId === req.id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-50">
                      <CheckGlyph className="w-3.5 h-3.5" /> {processingId === req.id ? '…' : 'Approve'}
                    </button>
                    <button onClick={() => setShowRejectForm(showRejectForm === req.id ? null : req.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-red-300 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-50">
                      <CloseIcon className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                )}
              </div>
              {showRejectForm === req.id && (
                <RejectForm value={rejectionReason} onChange={setRejectionReason} processing={processingId === req.id}
                  onConfirm={() => decide(req.id, 'REJECTED')} onCancel={() => { setShowRejectForm(null); setRejectionReason(''); }} />
              )}
            </div>
          ))}
          {totalPages > 1 && <Pagination page={page} totalPages={totalPages} setPage={setPage} />}
        </div>
      )}
    </div>
  );
}

// ── Access approvals ────────────────────────────────────────────────────────
function AccessApprovals({ tab, setTab, flashId }: { tab: Status; setTab: (s: Status) => void; flashId: string | null }) {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [counts, setCounts] = useState<Record<Status, number | null>>({ PENDING: null, APPROVED: null, REJECTED: null });
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState<string | null>(null);

  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  const fetchCounts = useCallback(async () => {
    try {
      const results = await Promise.all(
        (['PENDING', 'APPROVED', 'REJECTED'] as Status[]).map((s) =>
          fetch(`/api/access-requests?status=${s}`, { headers: authHeaders() }).then((r) => (r.ok ? r.json() : { requests: [] }))
        )
      );
      setCounts({ PENDING: results[0].requests.length, APPROVED: results[1].requests.length, REJECTED: results[2].requests.length });
    } catch { /* non-critical */ }
  }, []);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/access-requests?status=${tab}`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);
  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  const decide = async (id: string, action: 'APPROVE' | 'REJECT') => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/access-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(action === 'REJECT' ? { action, rejectionReason } : { action }),
      });
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== id));
        setShowRejectForm(null);
        setRejectionReason('');
        fetchCounts();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Failed to ${action === 'APPROVE' ? 'approve' : 'reject'}: ${err.message || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message || 'Failed to process request'}`);
    } finally { setProcessingId(null); }
  };

  return (
    <div className="space-y-4">
      <StatusTabs tab={tab} setTab={setTab} counts={counts} />
      {loading ? <Spinner /> : requests.length === 0 ? <EmptyState tab={tab} /> : (
        <div className="space-y-3">
          {requests.map((req) => {
            const who = req.user ? `${req.user.firstName} ${req.user.lastName}` : 'A user';
            return (
              <div key={req.id} id={`access-${req.id}`} className={`bg-white rounded-xl border border-gray-200 border-l-4 ${cardBorder(req.status)} shadow-sm p-4 ${highlightRingClass(flashId === req.id)}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-1.5"><LockIcon className="w-4 h-4 text-gray-400" /> After-Hours Access</h3>
                      <StatusPill status={req.status} />
                    </div>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">{who}</span>
                      {req.user && <span className="text-gray-400"> · {req.user.role}</span>}
                      <span className="text-gray-400"> · for {fmtDate(req.date)}</span>
                    </p>
                    <div className="mt-2 space-y-1 text-xs text-gray-500">
                      <p className="flex items-center gap-1.5">
                        <UserSingleIcon className="w-3.5 h-3.5" />
                        Requested <span className="text-gray-400">· {fmtDateTime(req.createdAt)}</span>
                        {req.user?.email && <span className="text-gray-400">· {req.user.email}</span>}
                      </p>
                      {req.reason && <p><span className="font-medium text-gray-600">Reason:</span> {req.reason}</p>}
                      {req.status === 'APPROVED' && req.reviewedAt && (
                        <p className="flex items-center gap-1.5 text-green-700"><CheckGlyph className="w-3.5 h-3.5" /> Approved <span className="text-green-600/70">· {fmtDateTime(req.reviewedAt)}</span></p>
                      )}
                      {req.status === 'REJECTED' && (
                        <>
                          {req.reviewedAt && <p className="flex items-center gap-1.5 text-red-600"><CloseIcon className="w-3.5 h-3.5" /> Rejected <span className="text-red-500/70">· {fmtDateTime(req.reviewedAt)}</span></p>}
                          {req.rejectionReason && <p className="text-red-600"><span className="font-medium">Rejection reason:</span> {req.rejectionReason}</p>}
                        </>
                      )}
                    </div>
                  </div>
                  {req.status === 'PENDING' && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => decide(req.id, 'APPROVE')} disabled={processingId === req.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-50">
                        <CheckGlyph className="w-3.5 h-3.5" /> {processingId === req.id ? '…' : 'Approve'}
                      </button>
                      <button onClick={() => setShowRejectForm(showRejectForm === req.id ? null : req.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-red-300 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-50">
                        <CloseIcon className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  )}
                </div>
                {showRejectForm === req.id && (
                  <RejectForm value={rejectionReason} onChange={setRejectionReason} processing={processingId === req.id}
                    onConfirm={() => decide(req.id, 'REJECT')} onCancel={() => { setShowRejectForm(null); setRejectionReason(''); }} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Reusable reject form + pagination ───────────────────────────────────────
function RejectForm({ value, onChange, processing, onConfirm, onCancel }: {
  value: string; onChange: (v: string) => void; processing: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
      <input type="text" placeholder="Reason for rejection (optional)" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
      <div className="flex gap-2">
        <button onClick={onConfirm} disabled={processing}
          className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-50">
          {processing ? 'Processing…' : 'Confirm Rejection'}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50">Cancel</button>
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, setPage }: { page: number; totalPages: number; setPage: (fn: (p: number) => number) => void }) {
  return (
    <div className="flex items-center justify-center gap-3 pt-3">
      <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
        className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40">Previous</button>
      <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
      <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
        className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40">Next</button>
    </div>
  );
}
