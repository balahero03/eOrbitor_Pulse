'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useRequireRole } from '@/lib/hooks/useRequireRole';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { useNotificationHighlight } from '@/lib/hooks/useNotificationHighlight';
import { highlightRingClass, HIGHLIGHT_EVENT, readPendingHighlight, HighlightRequest } from '@/lib/notificationHighlight';
import { SuccessIcon, ErrorIcon, PendingIcon, UserSingleIcon, ClipboardIcon, CheckGlyph, CloseIcon, LockIcon, UnlockIcon } from '@/components/icons';
import { useToast } from '@/components/Toast';
import PageContainer from '@/components/PageContainer';
import PageHeader from '@/components/PageHeader';
import { buttonClasses } from '@/components/Button';
import { InlineLoader } from '@/components/BrandedLoader';

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
  /** Only LEAD_TRANSFER carries this — the person the lead would move to. */
  targetUser?: { id: string; firstName: string; lastName: string };
  lead?: { id: string; name: string; company: string; status: string };
}

// After-hours access & Daily activity unlock requests.
interface AccessRequest {
  id: string;
  requestType?: 'AFTER_HOURS' | 'ACTIVITY_UNLOCK';
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
  LEAD_TRANSFER: 'Transfer Lead',
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
    <PageContainer>
      <PageHeader
        title="Approvals"
        subtitle="Review and manage pending approval requests"
        actions={canReviewAccess ? (
          <CategoryBar category={activeCategory} onChange={(c) => { setCategory(c); setTab('PENDING'); }} />
        ) : undefined}
      />

      {/* Status sub-tabs live inside each category so counts stay accurate. */}
      {activeCategory === 'record' ? (
        <RecordApprovals tab={tab} setTab={setTab} flashId={flashRecordId} />
      ) : (
        <AccessApprovals tab={tab} setTab={setTab} flashId={flashAccessId} />
      )}
    </PageContainer>
  );
}

/**
 * The page's one tab-pill style.
 *
 * The category bar and the status tabs had grown two near-identical copies of
 * this markup that had already drifted apart — different padding, different
 * count-badge colours, different hover. Defining it once is what keeps them
 * looking like the same control.
 */
function Pill({
  active,
  onClick,
  count,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number | null;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 min-h-[36px] sm:min-h-0 rounded-lg text-xs sm:text-sm font-semibold border transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 ${
        active
          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
      }`}
    >
      {icon}
      {children}
      {count !== null && count !== undefined && (
        <span
          className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full tabular-nums ${
            active ? 'bg-white/25 text-white' : count > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {count}
        </span>
      )}
    </button>
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
          <Pill
            key={it.key}
            active={active}
            onClick={() => onChange(it.key)}
            count={it.count}
            icon={<Icon className="w-4 h-4" color={active ? 'text-white' : undefined} />}
          >
            {it.label}
          </Pill>
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
          <Pill key={t.key} active={active} onClick={() => setTab(t.key)} count={count}>
            {t.label}
          </Pill>
        );
      })}
    </div>
  );
}

/**
 * The action being requested, as a chip.
 *
 * This used to be the card's `<h3>`, which put "Reopen Lead" above the name of
 * the lead in question — the request type shouted while the thing it applied to
 * was smaller underneath. Reviewing a queue means scanning for *what record*
 * first, so the type is a label now and the subject is the heading.
 */
function TypeChip({ label, danger }: { label: string; danger?: boolean }) {
  return (
    <span
      className={`inline-flex items-center text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border whitespace-nowrap ${
        danger
          ? 'bg-red-50 text-red-700 border-red-200'
          : 'bg-indigo-50 text-indigo-700 border-indigo-200'
      }`}
    >
      {label}
    </span>
  );
}

/**
 * Why the request was raised.
 *
 * Previously one more line of 12px grey among the timestamps, despite being the
 * only thing on the card that informs the decision. Given its own quoted block
 * so it reads as the requester's words.
 */
function ReasonBlock({ label, text, tone = 'neutral' }: { label: string; text: string; tone?: 'neutral' | 'danger' }) {
  const styles =
    tone === 'danger'
      ? 'bg-red-50 border-red-200 text-red-800'
      : 'bg-gray-50 border-gray-200 text-gray-700';
  return (
    <div className={`mt-2.5 rounded-lg border px-3 py-2 ${styles}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-60">{label}</p>
      <p className="text-sm mt-0.5 break-words">{text}</p>
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
      <ClipboardIcon className="w-9 h-9 mx-auto mb-2" color="text-gray-300" />
      <p className="text-gray-500">No {tab.toLowerCase()} requests</p>
    </div>
  );
}

function Spinner() {
  return (
    <InlineLoader />
  );
}

function cardBorder(status: Status) {
  return status === 'PENDING' ? 'border-l-amber-500' : status === 'APPROVED' ? 'border-l-green-500' : 'border-l-red-500';
}

// ── Record approvals ────────────────────────────────────────────────────────
function RecordApprovals({ tab, setTab, flashId }: { tab: Status; setTab: (s: Status) => void; flashId: string | null }) {
  const toast = useToast();
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
        toast.error(`Failed to ${status === 'APPROVED' ? 'approve' : 'reject'}: ${err.error || err.message || 'Unknown error'}`);
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message || 'Failed to process request'}`);
    } finally { setProcessingId(null); }
  };

  return (
    <div className="space-y-4">
      <StatusTabs tab={tab} setTab={setTab} counts={counts} />
      {loading ? <Spinner /> : requests.length === 0 ? <EmptyState tab={tab} /> : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} id={`approval-${req.entityId}`} className={`bg-white rounded-xl border border-gray-200 border-l-4 ${cardBorder(req.status)} shadow-sm p-4 ${highlightRingClass(flashId === req.entityId)}`}>
              {/* Content first, actions after — on a phone the buttons used to
                  sit in a flex-shrink-0 column beside the text, squeezing a
                  long company name into a two-character column. */}
              <div className="flex items-center gap-2 flex-wrap">
                <TypeChip
                  label={TYPE_LABEL[req.type] || 'Approval Request'}
                  danger={/DELETE/i.test(req.type)}
                />
                <StatusPill status={req.status} />
              </div>

              {req.lead ? (
                <div className="mt-2 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-[15px] break-words">{req.lead.name}</h3>
                  <p className="text-sm text-gray-500 break-words">
                    {req.lead.company}
                    <span className="text-gray-300"> · </span>
                    <span className="font-medium text-gray-600">{req.lead.status}</span>
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-gray-500 break-all">
                  {req.entityType} · {req.entityId.slice(0, 10)}…
                </p>
              )}

              {req.targetUser && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-gray-500 flex-wrap">
                  <UserSingleIcon className="w-3.5 h-3.5" />
                  Transfer to
                  <span className="font-semibold text-blue-700">
                    {req.targetUser.firstName} {req.targetUser.lastName}
                  </span>
                </p>
              )}

              {req.reason && <ReasonBlock label="Reason" text={req.reason} />}
              {req.status === 'REJECTED' && req.rejectionReason && (
                <ReasonBlock label="Rejection reason" text={req.rejectionReason} tone="danger" />
              )}

              {/* Footer: who asked, and what you can do about it. Stacks on a
                  phone with the two actions splitting the width evenly. */}
              <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                <div className="text-xs text-gray-500 min-w-0 space-y-1">
                  <p className="flex items-center gap-1.5 flex-wrap">
                    <UserSingleIcon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="font-medium text-gray-700 break-words">
                      {req.requestedByUser.firstName} {req.requestedByUser.lastName}
                    </span>
                    <span className="text-gray-400">· {fmtDateTime(req.createdAt)}</span>
                  </p>
                  {req.status === 'APPROVED' && req.approvedByUser && (
                    <p className="flex items-center gap-1.5 text-green-700 flex-wrap">
                      <CheckGlyph className="w-3.5 h-3.5 flex-shrink-0" />
                      Approved by
                      <span className="font-medium">{req.approvedByUser.firstName} {req.approvedByUser.lastName}</span>
                      <span className="text-green-600/70">· {fmtDateTime(req.updatedAt)}</span>
                    </p>
                  )}
                  {req.status === 'REJECTED' && req.approvedByUser && (
                    <p className="flex items-center gap-1.5 text-red-600 flex-wrap">
                      <CloseIcon className="w-3.5 h-3.5 flex-shrink-0" />
                      Rejected by
                      <span className="font-medium">{req.approvedByUser.firstName} {req.approvedByUser.lastName}</span>
                      <span className="text-red-500/70">· {fmtDateTime(req.updatedAt)}</span>
                    </p>
                  )}
                </div>

                {req.status === 'PENDING' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => decide(req.id, 'APPROVED')} disabled={processingId === req.id}
                      className={buttonClasses({ variant: 'success', size: 'sm', className: 'flex-1 sm:flex-initial' })}>
                      <CheckGlyph className="w-3.5 h-3.5" color="text-white" /> {processingId === req.id ? 'Approving…' : 'Approve'}
                    </button>
                    <button onClick={() => setShowRejectForm(showRejectForm === req.id ? null : req.id)}
                      className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'flex-1 sm:flex-initial border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400' })}>
                      <CloseIcon className="w-3.5 h-3.5" color="text-red-600" /> Reject
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
  const toast = useToast();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [counts, setCounts] = useState<Record<Status, number | null>>({ PENDING: null, APPROVED: null, REJECTED: null });
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'AFTER_HOURS' | 'ACTIVITY_UNLOCK'>('ALL');
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
        toast.error(`Failed to ${action === 'APPROVE' ? 'approve' : 'reject'}: ${err.message || 'Unknown error'}`);
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message || 'Failed to process request'}`);
    } finally { setProcessingId(null); }
  };

  const filteredRequests = requests.filter((r) => {
    if (typeFilter === 'ALL') return true;
    if (typeFilter === 'ACTIVITY_UNLOCK') return r.requestType === 'ACTIVITY_UNLOCK';
    return r.requestType !== 'ACTIVITY_UNLOCK'; // AFTER_HOURS or undefined
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusTabs tab={tab} setTab={setTab} counts={counts} />
        {/* Sub-type filter pills */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs font-medium">
          <button
            onClick={() => setTypeFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${typeFilter === 'ALL' ? 'bg-white text-gray-800 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'}`}
          >
            All Access Requests
          </button>
          <button
            onClick={() => setTypeFilter('AFTER_HOURS')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${typeFilter === 'AFTER_HOURS' ? 'bg-white text-amber-700 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <LockIcon className="w-3.5 h-3.5" color="text-amber-600" />
            After-Hours Access
          </button>
          <button
            onClick={() => setTypeFilter('ACTIVITY_UNLOCK')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${typeFilter === 'ACTIVITY_UNLOCK' ? 'bg-white text-indigo-700 shadow-sm font-semibold' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <UnlockIcon className="w-3.5 h-3.5" color="text-indigo-600" />
            Activity Date Unlock
          </button>
        </div>
      </div>

      {loading ? <Spinner /> : filteredRequests.length === 0 ? <EmptyState tab={tab} /> : (
        <div className="space-y-3">
          {filteredRequests.map((req) => {
            const who = req.user ? `${req.user.firstName} ${req.user.lastName}` : 'A user';
            const isActivityUnlock = req.requestType === 'ACTIVITY_UNLOCK';

            return (
              <div key={req.id} id={`access-${req.id}`} className={`bg-white rounded-xl border border-gray-200 border-l-4 ${cardBorder(req.status)} shadow-sm p-4 ${highlightRingClass(flashId === req.id)}`}>
                {/* Same shape as a record request, so the two categories read
                    as one queue rather than two designs. */}
                <div className="flex items-center gap-2 flex-wrap">
                  {isActivityUnlock ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border bg-indigo-50 text-indigo-700 border-indigo-200 whitespace-nowrap">
                      <UnlockIcon className="w-3.5 h-3.5" color="text-indigo-600" /> Activity Unlock
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border bg-amber-50 text-amber-700 border-amber-200 whitespace-nowrap">
                      <LockIcon className="w-3.5 h-3.5" color="text-amber-600" /> After-Hours
                    </span>
                  )}
                  <StatusPill status={req.status} />
                </div>

                <div className="mt-2 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-[15px] break-words">{who}</h3>
                  <p className="text-sm text-gray-500 break-words">
                    {req.user?.role && <>{req.user.role}<span className="text-gray-300"> · </span></>}
                    for <span className="font-medium text-gray-600">{fmtDate(req.date)}</span>
                  </p>
                </div>

                {req.reason && <ReasonBlock label="Reason" text={req.reason} />}
                {req.status === 'REJECTED' && req.rejectionReason && (
                  <ReasonBlock label="Rejection reason" text={req.rejectionReason} tone="danger" />
                )}

                <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                  <div className="text-xs text-gray-500 min-w-0 space-y-1">
                    <p className="flex items-center gap-1.5 flex-wrap">
                      <UserSingleIcon className="w-3.5 h-3.5 flex-shrink-0" />
                      Requested <span className="text-gray-400">· {fmtDateTime(req.createdAt)}</span>
                      {req.user?.email && <span className="text-gray-400 break-all">· {req.user.email}</span>}
                    </p>
                    {req.status === 'APPROVED' && req.reviewedAt && (
                      <p className="flex items-center gap-1.5 text-green-700 flex-wrap">
                        <CheckGlyph className="w-3.5 h-3.5 flex-shrink-0" /> Approved
                        <span className="text-green-600/70">· {fmtDateTime(req.reviewedAt)}</span>
                      </p>
                    )}
                    {req.status === 'REJECTED' && req.reviewedAt && (
                      <p className="flex items-center gap-1.5 text-red-600 flex-wrap">
                        <CloseIcon className="w-3.5 h-3.5 flex-shrink-0" /> Rejected
                        <span className="text-red-500/70">· {fmtDateTime(req.reviewedAt)}</span>
                      </p>
                    )}
                  </div>

                  {req.status === 'PENDING' && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => decide(req.id, 'APPROVE')} disabled={processingId === req.id}
                        className={buttonClasses({ variant: 'success', size: 'sm', className: 'flex-1 sm:flex-initial' })}>
                        <CheckGlyph className="w-3.5 h-3.5" color="text-white" /> {processingId === req.id ? 'Approving…' : 'Approve'}
                      </button>
                      <button onClick={() => setShowRejectForm(showRejectForm === req.id ? null : req.id)}
                        className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'flex-1 sm:flex-initial border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400' })}>
                        <CloseIcon className="w-3.5 h-3.5" color="text-red-600" /> Reject
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
      <div className="flex gap-2 flex-wrap">
        <button onClick={onConfirm} disabled={processing}
          className={buttonClasses({ variant: 'danger', size: 'xs' })}>
          {processing ? 'Processing…' : 'Confirm Rejection'}
        </button>
        <button onClick={onCancel} className={buttonClasses({ variant: 'secondary', size: 'xs' })}>Cancel</button>
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, setPage }: { page: number; totalPages: number; setPage: (fn: (p: number) => number) => void }) {
  return (
    <div className="flex items-center justify-center gap-3 pt-3">
      <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
        className={buttonClasses({ variant: 'secondary', size: 'sm' })}>Previous</button>
      <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
      <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
        className={buttonClasses({ variant: 'secondary', size: 'sm' })}>Next</button>
    </div>
  );
}
