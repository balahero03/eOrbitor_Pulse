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
/**
 * Segmented control — one recessed track, the active option raised out of it.
 *
 * The page previously had two treatments side by side: filled blue pills for
 * the status and category filters, and this recessed track for the access-type
 * filter. Two controls doing the same job should not look like different kinds
 * of control, so the recessed one wins — it reads as "pick one of these",
 * whereas a row of filled pills reads as a row of buttons.
 */
function Segmented({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`inline-flex items-center gap-1 bg-gray-100 p-1 rounded-xl ${className}`}>
      {children}
    </div>
  );
}

function Segment({
  active,
  onClick,
  count,
  icon,
  activeColor = 'text-gray-800',
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number | null;
  icon?: ReactNode;
  /** Lets a segment keep its own identity colour when selected. */
  activeColor?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] sm:min-h-0 rounded-lg text-xs sm:text-sm transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 ${
        active ? `bg-white ${activeColor} shadow-sm font-semibold` : 'text-gray-600 font-medium hover:text-gray-900'
      }`}
    >
      {icon}
      {children}
      {count !== null && count !== undefined && (
        <span
          className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full tabular-nums ${
            count > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-200/70 text-gray-500'
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
    <Segmented className="max-w-full overflow-x-auto">
      {items.map((it) => {
        const active = category === it.key;
        const Icon = it.icon;
        return (
          <Segment
            key={it.key}
            active={active}
            onClick={() => onChange(it.key)}
            count={it.count}
            icon={<Icon className="w-4 h-4" />}
          >
            {it.label}
          </Segment>
        );
      })}
    </Segmented>
  );
}

// ── Shared bits ─────────────────────────────────────────────────────────────
function StatusTabs({ tab, setTab, counts }: { tab: Status; setTab: (s: Status) => void; counts: Record<Status, number | null> }) {
  return (
    <Segmented>
      {STATUS_TABS.map((t) => {
        const active = tab === t.key;
        const count = counts[t.key];
        return (
          <Segment key={t.key} active={active} onClick={() => setTab(t.key)} count={count}>
            {t.label}
          </Segment>
        );
      })}
    </Segmented>
  );
}

/**
 * What is being asked for, as a quiet inline label.
 *
 * This was an uppercase filled chip, which put it in direct competition with
 * the status badge and the reason heading — three shouty micro-labels on a card
 * whose actual content is two lines long. The action matters, but it is context
 * for the record name, not a headline of its own.
 */
/**
 * One labelled fact on a request card.
 *
 * The metadata used to run together on one line — "Requested · 11 Aug 2026 at
 * 15:06 · sales@eorbitor.com" — where every value looked alike and none was
 * named. As a labelled cell each fact says what it is, and the row wraps
 * instead of overflowing on a phone.
 */
function Fact({ label, value, tone = 'default' }: { label: string; value: ReactNode; tone?: 'default' | 'good' | 'bad' }) {
  const valueTone = tone === 'good' ? 'text-green-700' : tone === 'bad' ? 'text-red-600' : 'text-gray-800';
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</dt>
      <dd className={`text-[13px] font-medium mt-0.5 break-words ${valueTone}`}>{value}</dd>
    </div>
  );
}

function ActionLabel({ label, danger }: { label: string; danger?: boolean }) {
  return (
    <span className={`font-semibold ${danger ? 'text-red-600' : 'text-gray-700'}`}>{label}</span>
  );
}

/**
 * The requester's words.
 *
 * Was a bordered grey panel with an uppercase "REASON" heading — a lot of
 * furniture around one short sentence. A left rule and quotation marks say the
 * same thing without the box, and read as something a person wrote.
 */
function ReasonBlock({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'danger' }) {
  const rule = tone === 'danger' ? 'border-red-300' : 'border-gray-200';
  const body = tone === 'danger' ? 'text-red-700' : 'text-gray-600';
  return (
    <blockquote className={`mt-2.5 border-l-2 ${rule} pl-3 text-sm ${body} break-words`}>
      {tone === 'danger' && <span className="font-medium">Rejected: </span>}
      &ldquo;{text}&rdquo;
    </blockquote>
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
              {/* Name first, then what is being asked of it — the status badge
                  is pushed right so it lines up down the list instead of
                  crowding the title. */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 text-[15px] break-words leading-snug">
                    {req.lead ? req.lead.name : `${req.entityType} ${req.entityId.slice(0, 8)}…`}
                  </h3>
                  <p className="text-sm text-gray-500 break-words mt-0.5">
                    <ActionLabel
                      label={TYPE_LABEL[req.type] || 'Approval request'}
                      danger={/DELETE/i.test(req.type)}
                    />
                    {req.lead && (
                      <>
                        <span className="text-gray-300"> · </span>{req.lead.company}
                        <span className="text-gray-300"> · </span>{req.lead.status}
                      </>
                    )}
                  </p>
                </div>
                <div className="flex-shrink-0"><StatusPill status={req.status} /></div>
              </div>

              {req.targetUser && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-gray-500 flex-wrap">
                  <UserSingleIcon className="w-3.5 h-3.5" />
                  Transfer to
                  <span className="font-semibold text-blue-700">
                    {req.targetUser.firstName} {req.targetUser.lastName}
                  </span>
                </p>
              )}

              {req.reason && <ReasonBlock text={req.reason} />}
              {req.status === 'REJECTED' && req.rejectionReason && (
                <ReasonBlock text={req.rejectionReason} tone="danger" />
              )}

              {/* The facts of the request, each one named. */}
              <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
                <Fact
                  label="Requested by"
                  value={`${req.requestedByUser.firstName} ${req.requestedByUser.lastName}`}
                />
                <Fact label="Requested" value={fmtDateTime(req.createdAt)} />
                {req.targetUser && (
                  <Fact
                    label="Transfer to"
                    value={<span className="text-blue-700">{req.targetUser.firstName} {req.targetUser.lastName}</span>}
                  />
                )}
                {req.status === 'APPROVED' && req.approvedByUser && (
                  <Fact
                    label="Approved by"
                    tone="good"
                    value={`${req.approvedByUser.firstName} ${req.approvedByUser.lastName} · ${fmtDateTime(req.updatedAt)}`}
                  />
                )}
                {req.status === 'REJECTED' && req.approvedByUser && (
                  <Fact
                    label="Rejected by"
                    tone="bad"
                    value={`${req.approvedByUser.firstName} ${req.approvedByUser.lastName} · ${fmtDateTime(req.updatedAt)}`}
                  />
                )}
              </dl>

              {req.status === 'PENDING' && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                  <button onClick={() => setShowRejectForm(showRejectForm === req.id ? null : req.id)}
                    className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'flex-1 sm:flex-initial border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400' })}>
                    <CloseIcon className="w-3.5 h-3.5" color="text-red-600" /> Reject
                  </button>
                  <button onClick={() => decide(req.id, 'APPROVED')} disabled={processingId === req.id}
                    className={buttonClasses({ variant: 'success', size: 'sm', className: 'flex-1 sm:flex-initial' })}>
                    <CheckGlyph className="w-3.5 h-3.5" color="text-white" /> {processingId === req.id ? 'Approving…' : 'Approve'}
                  </button>
                </div>
              )}
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
        {/* Sub-type filter — same control as the status tabs above it. */}
        <Segmented className="max-w-full overflow-x-auto">
          <Segment active={typeFilter === 'ALL'} onClick={() => setTypeFilter('ALL')}>
            All Access Requests
          </Segment>
          <Segment
            active={typeFilter === 'AFTER_HOURS'}
            onClick={() => setTypeFilter('AFTER_HOURS')}
            activeColor="text-amber-700"
            icon={<LockIcon className="w-3.5 h-3.5" color="text-amber-600" />}
          >
            After-Hours Access
          </Segment>
          <Segment
            active={typeFilter === 'ACTIVITY_UNLOCK'}
            onClick={() => setTypeFilter('ACTIVITY_UNLOCK')}
            activeColor="text-indigo-700"
            icon={<UnlockIcon className="w-3.5 h-3.5" color="text-indigo-600" />}
          >
            Activity Date Unlock
          </Segment>
        </Segmented>
      </div>

      {loading ? <Spinner /> : filteredRequests.length === 0 ? <EmptyState tab={tab} /> : (
        <div className="space-y-3">
          {filteredRequests.map((req) => {
            const who = req.user ? `${req.user.firstName} ${req.user.lastName}` : 'A user';
            const isActivityUnlock = req.requestType === 'ACTIVITY_UNLOCK';

            return (
              <div key={req.id} id={`access-${req.id}`} className={`bg-white rounded-xl border border-gray-200 border-l-4 ${cardBorder(req.status)} shadow-sm p-4 ${highlightRingClass(flashId === req.id)}`}>
                {/* Identity at the top, the facts of the request in a labelled
                    row beneath, then the requester's words. Same shape as a
                    record request so the two categories read as one queue. */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 text-[15px] break-words leading-snug">{who}</h3>
                    <p className="text-sm text-gray-500 break-words mt-0.5 inline-flex items-center gap-1.5 flex-wrap">
                      {isActivityUnlock
                        ? <UnlockIcon className="w-3.5 h-3.5" color="text-indigo-500" />
                        : <LockIcon className="w-3.5 h-3.5" color="text-amber-500" />}
                      <ActionLabel label={isActivityUnlock ? 'Activity unlock' : 'After-hours access'} />
                      {req.user?.role && <><span className="text-gray-300">·</span>{req.user.role}</>}
                    </p>
                  </div>
                  <div className="flex-shrink-0"><StatusPill status={req.status} /></div>
                </div>

                <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
                  <Fact label={isActivityUnlock ? 'Unlock date' : 'Access date'} value={fmtDate(req.date)} />
                  <Fact label="Requested" value={fmtDateTime(req.createdAt)} />
                  {req.status === 'APPROVED' && req.reviewedAt && (
                    <Fact label="Approved" value={fmtDateTime(req.reviewedAt)} tone="good" />
                  )}
                  {req.status === 'REJECTED' && req.reviewedAt && (
                    <Fact label="Rejected" value={fmtDateTime(req.reviewedAt)} tone="bad" />
                  )}
                  {req.user?.email && (
                    <Fact label="Email" value={<span className="break-all">{req.user.email}</span>} />
                  )}
                </dl>

                {req.reason && <ReasonBlock text={req.reason} />}
                {req.status === 'REJECTED' && req.rejectionReason && (
                  <ReasonBlock text={req.rejectionReason} tone="danger" />
                )}

                {req.status === 'PENDING' && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                    <button onClick={() => setShowRejectForm(showRejectForm === req.id ? null : req.id)}
                      className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'flex-1 sm:flex-initial border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400' })}>
                      <CloseIcon className="w-3.5 h-3.5" color="text-red-600" /> Reject
                    </button>
                    <button onClick={() => decide(req.id, 'APPROVE')} disabled={processingId === req.id}
                      className={buttonClasses({ variant: 'success', size: 'sm', className: 'flex-1 sm:flex-initial' })}>
                      <CheckGlyph className="w-3.5 h-3.5" color="text-white" /> {processingId === req.id ? 'Approving…' : 'Approve'}
                    </button>
                  </div>
                )}
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
