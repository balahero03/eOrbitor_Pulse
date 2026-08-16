'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDelayedFlag } from '@/lib/hooks/useDelayedFlag';
import type { ReactNode } from 'react';
import { useRequireRole } from '@/lib/hooks/useRequireRole';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { highlightRingClass, HIGHLIGHT_VISIBLE_MS } from '@/lib/notificationHighlight';
import { SuccessIcon, ErrorIcon, PendingIcon, UserSingleIcon, ClipboardIcon, CheckGlyph, CloseIcon, LockIcon, UnlockIcon } from '@/components/icons';
import { useToast } from '@/components/Toast';
import PageContainer from '@/components/PageContainer';
import PageHeader from '@/components/PageHeader';
import { buttonClasses } from '@/components/Button';
import { InlineLoader } from '@/components/BrandedLoader';

type Status = 'PENDING' | 'APPROVED' | 'REJECTED';
type Category = 'record' | 'access';

/**
 * A notification target that has been "armed" for highlighting, scoped to the
 * exact category/tab it belongs to. Passed down as one unit (rather than a
 * bare id) so a list can never show a ring for a target that isn't actually
 * meant for the view it's currently rendering — the render-time check lives
 * in the parent, but each list also matches on the id itself, so a stale or
 * mismatched armed object still can't light up the wrong card.
 */
interface ArmedHighlight { category: Category; tab: Status; id: string; nonce: string }

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

function ApprovalsContent() {
  useRequireRole(['SUPER_ADMIN', 'ADMIN', 'BACKEND_TEAM']);
  const { user } = useCurrentUser();
  const searchParams = useSearchParams();
  const paramTab = searchParams?.get('tab') as Status | null;
  const paramCategory = searchParams?.get('category') as Category | null;
  const paramId = searchParams?.get('id');
  // Bumped by the notification handler on every click. Without it, clicking the
  // same notification twice pushes an identical URL, nothing in searchParams
  // changes, and the effects below never re-run — so the second click did
  // nothing at all.
  const paramNonce = searchParams?.get('n');

  // Only admins can decide after-hours access requests (the API gates that),
  // and the request list is admin-scoped — so the Access category is admin-only.
  const canReviewAccess = !!user && ['SUPER_ADMIN', 'ADMIN'].includes(user.role);

  const [category, setCategory] = useState<Category>(() => {
    if (paramCategory === 'access' && canReviewAccess) return 'access';
    return 'record';
  });
  const [tab, setTab] = useState<Status>(() => {
    if (paramTab && ['PENDING', 'APPROVED', 'REJECTED'].includes(paramTab)) return paramTab;
    return 'PENDING';
  });

  // ── Where the highlight comes from ────────────────────────────────────────
  //
  // The URL, and only the URL. The notification handler resolves the record's
  // *current* status before navigating and encodes it as
  // `?category=…&tab=…&id=…`, so by the time this page mounts the destination
  // is already decided.
  //
  // It used to be decided here as well, three more times over: a
  // `syncHighlightTab` that re-fetched the status and called setTab, a
  // HIGHLIGHT_EVENT listener that did the same, a readPendingHighlight on
  // mount that did it again, and a fourth setTab inside the list's own fetch.
  // Each of those could land after the others, so the tab was whichever
  // request happened to finish last — and every setTab re-ran the fetch that
  // triggered it. That is what made clicking a notification land on the wrong
  // tab, or flick between two.
  useEffect(() => {
    if (paramCategory === 'access' && canReviewAccess) setCategory('access');
    else if (paramCategory === 'record') setCategory('record');
  }, [paramCategory, paramNonce, canReviewAccess]);

  useEffect(() => {
    if (paramTab && ['PENDING', 'APPROVED', 'REJECTED'].includes(paramTab)) setTab(paramTab as Status);
  }, [paramTab, paramNonce]);

  // ── What is "armed" to be highlighted ───────────────────────────────────────
  //
  // Carries the category and tab the target belongs to, not just its id. A
  // bare id let the highlight survive a manual tab switch and land on whatever
  // the new tab happened to show — including, via the single-item fallback
  // this replaces, a completely unrelated record that just happened to be the
  // only row on that tab. Recording where the target *belongs* is what lets
  // the render below refuse to show it anywhere else.
  const [armed, setArmed] = useState<ArmedHighlight | null>(null);

  // Re-armed from the URL on mount and on every notification click (paramNonce
  // changes each time, including a repeat click on the same notification —
  // see the key on the card below for why that matters). Auto-clears after
  // HIGHLIGHT_VISIBLE_MS so the ring is not left on indefinitely if nothing
  // else dismisses it first.
  useEffect(() => {
    if (!paramId || !paramTab || !['PENDING', 'APPROVED', 'REJECTED'].includes(paramTab)) {
      setArmed(null);
      return;
    }
    const armedCategory: Category = paramCategory === 'access' && canReviewAccess ? 'access' : 'record';
    setArmed({ category: armedCategory, tab: paramTab as Status, id: paramId, nonce: paramNonce ?? paramId });
    const t = setTimeout(() => setArmed(null), HIGHLIGHT_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [paramId, paramTab, paramCategory, paramNonce, canReviewAccess]);

  // Manual navigation dismisses the armed highlight immediately and for good —
  // not just until the tab happens to match again. Revisiting the original tab
  // later in the same window should not cause a surprise re-highlight; the
  // ring is a one-time "look here" cue, not a standing state.
  const dismissHighlight = useCallback(() => setArmed(null), []);
  const handleTabChange = useCallback((s: Status) => { setTab(s); dismissHighlight(); }, [dismissHighlight]);
  const handleCategoryChange = useCallback(
    (c: Category) => { setCategory(c); setTab('PENDING'); dismissHighlight(); },
    [dismissHighlight],
  );

  const activeCategory = canReviewAccess ? category : 'record';

  // The only thing ever handed to the lists as "flash this id". Requires an
  // exact match on *both* category and tab against what was armed, so a
  // mismatched view can never show a ring — by construction, not by every
  // call site remembering to clear something.
  const effectiveHighlight =
    armed && armed.category === activeCategory && armed.tab === tab ? armed : null;

  return (
    <PageContainer>
      <PageHeader
        title="Approvals"
        subtitle="Review and manage pending approval requests"
        actions={canReviewAccess ? (
          <CategoryBar category={activeCategory} onChange={handleCategoryChange} />
        ) : undefined}
      />

      <div className="grid">
        <div
          className={`[grid-area:1/1] transition-opacity duration-200 ${
            activeCategory === 'record' ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <RecordApprovals tab={tab} setTab={handleTabChange} flash={activeCategory === 'record' ? effectiveHighlight : null} />
        </div>
        {canReviewAccess && (
          <div
            className={`[grid-area:1/1] transition-opacity duration-200 ${
              activeCategory === 'access' ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <AccessApprovals tab={tab} setTab={handleTabChange} flash={activeCategory === 'access' ? effectiveHighlight : null} />
          </div>
        )}
      </div>
    </PageContainer>
  );
}

export default function ApprovalsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[70vh]">
          <InlineLoader />
        </div>
      }
    >
      <ApprovalsContent />
    </Suspense>
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
      className={`tab-button inline-flex items-center gap-1.5 px-3.5 py-1.5 min-h-[34px] sm:min-h-0 rounded-lg text-xs sm:text-sm transition-all duration-200 ease-out active:scale-95 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 ${
        active ? `bg-white ${activeColor} shadow-sm font-semibold scale-[1.01]` : 'text-gray-600 font-medium hover:text-gray-900 hover:bg-gray-200/50'
      }`}
    >
      {icon}
      {children}
      {count !== null && count !== undefined && (
        <span
          className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full tabular-nums transition-colors ${
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
/**
 * Status filter: rounded pills, the selected one filled.
 *
 * Deliberately *not* the segmented track used by the access-type filter beside
 * it. These two do different jobs: the track switches which set of requests you
 * are looking at, while these narrow the set you are already in. Giving the
 * narrowing filter its own filled-pill treatment keeps the distinction, and the
 * filled state reads as "this is what you are seeing" more strongly than a
 * raised white segment does.
 */
function StatusTabs({ tab, setTab, counts }: { tab: Status; setTab: (s: Status) => void; counts: Record<Status, number | null> }) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-2 pb-2 px-1 -mx-1">
      {STATUS_TABS.map((t) => {
        const active = tab === t.key;
        const count = counts[t.key];
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`filter-pill flex-shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-all duration-200 ease-out active:scale-95 ${
              active
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm scale-[1.02] ring-2 ring-blue-400/40'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50/80 hover:text-gray-900'
            }`}
          >
            {t.label}
            {count !== null && count !== undefined && (
              <span
                className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums ${
                  active
                    ? 'bg-white/25 text-white'
                    : count > 0
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-gray-100 text-gray-500'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
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

/**
 * Colour for the card's left status accent — see `.status-accent-card` in
 * globals.css for how it's actually drawn.
 *
 * It used to be `border-l-4 border-l-<color>` sitting alongside a uniform
 * `border border-gray-200` — so the left edge was 4px while the other three
 * were 1px. `border-radius` only blends a corner smoothly when every side's
 * border is the same width; with one side four times the others, the
 * top-left corner rendered as a visibly jagged, kinked curve rather than a
 * clean arc. It was there on every card all along — the highlight ring's
 * own perfectly smooth corner sitting right next to it is what made it
 * obvious enough to notice, but a zoomed capture of a plain, unhighlighted
 * card showed the same kink.
 *
 * First fix attempt folded the accent into the card's own `box-shadow`
 * (an inset shadow, which — unlike a border — is clipped to the rounded
 * border-box with no per-side width to distort). That was wrong in a
 * different way: the highlight glow just below also animates `box-shadow`
 * on this same element, and a CSS animation owns its target property
 * outright for as long as it runs — a static shadow set alongside it simply
 * disappears the moment the animation starts. Confirmed by rendering a
 * highlighted card: the accent bar was gone entirely, replaced by the
 * glow's own shadow, for the full ~5s the ring was up.
 *
 * The accent now lives on its own `::before`, a layer the glow animation
 * never touches, so the two can run at once without either one erasing the
 * other. Colour reaches it through a CSS custom property set inline per
 * card, since a pseudo-element can't read a Tailwind class directly.
 */
function statusAccentColor(status: Status): string {
  return status === 'PENDING' ? '#f59e0b' : status === 'APPROVED' ? '#22c55e' : '#ef4444';
}

// ── Record approvals ────────────────────────────────────────────────────────
function RecordApprovals({ tab, setTab, flash }: { tab: Status; setTab: (s: Status) => void; flash: ArmedHighlight | null }) {
  const toast = useToast();
  const flashId = flash?.id ?? null;
  const [requests, setRequests] = useState<RecordRequest[]>([]);
  const [counts, setCounts] = useState<Record<Status, number | null>>({ PENDING: null, APPROVED: null, REJECTED: null });
  const [loading, setLoading] = useState(true);
  // Separate from `loading`: true on every fetch, including a tab switch.
  // `loading` only gates the very first render (nothing to show yet); after
  // that, the previous tab's list stays on screen — dimmed, not replaced —
  // while the new one loads, so switching tabs never flashes back to a
  // spinner or an empty state.
  const [refreshing, setRefreshing] = useState(false);
  // Only actually dims the list once the fetch has been running for 150ms —
  // see lib/hooks/useDelayedFlag.ts. Without this, a fast API response
  // reverses the opacity transition before it ever finishes animating, which
  // reads as a one-frame flicker rather than a fade.
  const showRefreshing = useDelayedFlag(refreshing);
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
    setRefreshing(true);
    try {
      const res = await fetch(`/api/approval-requests?status=${tab}&page=${page}&limit=${PAGE_SIZE}`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      let list: RecordRequest[] = data.requests || [];

      // If a flashId is requested and not in the current page list, fetch it and prepend so it's visible & highlighted
      if (flashId && !list.some((r) => r.entityId === flashId || r.id === flashId)) {
        try {
          const singleRes = await fetch(`/api/approval-requests?entityId=${flashId}&status=ALL`, { headers: authHeaders() });
          if (singleRes.ok) {
            const singleData = await singleRes.json();
            const found = singleData.requests?.find((r: RecordRequest) => (r.entityId === flashId || r.id === flashId || (r as any).leadId === flashId));
            // Only surface it if it genuinely belongs on this tab. It might
            // simply be on a later page of the same list, which is worth
            // pulling forward; if its status does not match, the tab is wrong
            // and the fix is in the URL, not in quietly showing a card that
            // contradicts the tab it is sitting under.
            if (found && found.status === tab && !list.some((r) => r.id === found.id)) {
              list = [found, ...list];
            }
          }
        } catch { /* continue */ }
      }

      setRequests(list);
      setTotalPages(data.pagination?.pages || 1);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  }, [tab, page, flashId]);

  useEffect(() => { setPage(1); }, [tab]);
  useEffect(() => { fetchRequests(); }, [fetchRequests]);
  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  // Smoothly center the target card into view as soon as requests are loaded
  useEffect(() => {
    if (!flashId || requests.length === 0) return;
    const target = requests.find((r) => r.entityId === flashId || r.id === flashId || (r as any).leadId === flashId);
    if (target) {
      const scrollIt = () => {
        const el =
          document.getElementById(`approval-${target.entityId}`) ||
          document.getElementById(`approval-${target.id}`) ||
          document.querySelector(`[data-highlight-id="${flashId}"]`) ||
          document.querySelector(`[data-request-id="${target.id}"]`) ||
          document.querySelector(`[data-entity-id="${target.entityId}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      };
      scrollIt();
      const t1 = setTimeout(scrollIt, 120);
      const t2 = setTimeout(scrollIt, 450);
      const t3 = setTimeout(scrollIt, 900);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
  }, [flashId, requests]);

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
        <div className={`space-y-3 transition-opacity duration-200 ${showRefreshing ? 'opacity-40' : 'opacity-100'}`}>
          {requests.map((req) => {
            // Exact ID match only. There used to be a fallback here that lit
            // up a tab's one-and-only row whenever the target id wasn't found
            // in it — meant for some ID-mismatch edge case, but it fired on
            // pure coincidence and was the actual cause of an unrelated
            // record lighting up on a tab the user had switched to.
            const isHighlighted =
              Boolean(flashId) &&
              (flashId === req.entityId ||
                flashId === req.id ||
                (req as any).leadId === flashId ||
                flashId?.toLowerCase() === req.entityId?.toLowerCase() ||
                flashId?.toLowerCase() === req.id?.toLowerCase());

            return (
              <div
                // Remounts just this one card when the *same* notification is
                // clicked again (paramNonce changes on every click). Without
                // it, re-arming an already-highlighted id sets the identical
                // className twice, React skips the DOM write, and the CSS
                // animation never restarts — a repeat click produced no
                // visible response at all.
                key={isHighlighted ? `${req.id}-hl-${flash?.nonce}` : req.id}
                id={`approval-${req.entityId}`}
                data-highlight-id={req.entityId}
                data-entity-id={req.entityId}
                data-request-id={req.id}
                data-lead-id={(req as any).leadId}
                style={{ '--status-accent': statusAccentColor(req.status) } as React.CSSProperties}
                className={`relative status-accent-card bg-white rounded-xl border border-gray-200 shadow-sm p-4 transition-all duration-300 ${
                  isHighlighted ? 'premium-highlight-card' : ''
                }`}
              >

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
            );
          })}
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
            className={buttonClasses({ variant: 'secondary', size: 'sm' })}>Previous</button>
          <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            className={buttonClasses({ variant: 'secondary', size: 'sm' })}>Next</button>
        </div>
      )}
    </div>
  );
}

// ── Access approvals ────────────────────────────────────────────────────────
function AccessApprovals({ tab, setTab, flash }: { tab: Status; setTab: (s: Status) => void; flash: ArmedHighlight | null }) {
  const toast = useToast();
  const flashId = flash?.id ?? null;
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'AFTER_HOURS' | 'ACTIVITY_UNLOCK'>('ALL');
  const [counts, setCounts] = useState<Record<Status, number | null>>({ PENDING: null, APPROVED: null, REJECTED: null });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const showRefreshing = useDelayedFlag(refreshing);
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
    setRefreshing(true);
    try {
      const res = await fetch(`/api/access-requests?status=${tab}`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      let list: AccessRequest[] = data.requests || [];

      if (flashId && !list.some((r) => r.id === flashId)) {
        try {
          const singleRes = await fetch(`/api/access-requests?id=${flashId}`, { headers: authHeaders() });
          if (singleRes.ok) {
            const singleData = await singleRes.json();
            const found = singleData.requests?.find((r: AccessRequest) => r.id === flashId || (r as any).userId === flashId);
            // Only surface it if it genuinely belongs on this tab. It might
            // simply be on a later page of the same list, which is worth
            // pulling forward; if its status does not match, the tab is wrong
            // and the fix is in the URL, not in quietly showing a card that
            // contradicts the tab it is sitting under.
            if (found && found.status === tab && !list.some((r) => r.id === found.id)) {
              list = [found, ...list];
            }
          }
        } catch { /* continue */ }
      }

      setRequests(list);
    } catch (err) { console.error(err); }
    finally { setLoading(false); setRefreshing(false); }
  }, [tab, flashId, setTab]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);
  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  // Smoothly center the target card into view as soon as requests are loaded
  useEffect(() => {
    if (!flashId || requests.length === 0) return;
    const target = requests.find((r) => r.id === flashId || (r as any).userId === flashId);
    if (target) {
      const scrollIt = () => {
        const el =
          document.getElementById(`access-${target.id}`) ||
          document.querySelector(`[data-highlight-id="${flashId}"]`) ||
          document.querySelector(`[data-request-id="${target.id}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      };
      scrollIt();
      const t1 = setTimeout(scrollIt, 120);
      const t2 = setTimeout(scrollIt, 450);
      const t3 = setTimeout(scrollIt, 900);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
  }, [flashId, requests]);

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
        <div className={`space-y-3 transition-opacity duration-200 ${showRefreshing ? 'opacity-40' : 'opacity-100'}`}>
          {(() => {
            return filteredRequests.map((req) => {
              const who = req.user ? `${req.user.firstName} ${req.user.lastName}` : 'A user';
              const isActivityUnlock = req.requestType === 'ACTIVITY_UNLOCK';
              // Exact ID match only — see the equivalent comment in
              // RecordApprovals for why the single-item fallback this replaced
              // is gone rather than fixed.
              const isHighlighted =
                Boolean(flashId) &&
                (flashId === req.id ||
                  flashId === (req as any).userId ||
                  flashId?.toLowerCase() === req.id?.toLowerCase());

              return (
                <div
                  key={isHighlighted ? `${req.id}-hl-${flash?.nonce}` : req.id}
                  id={`access-${req.id}`}
                  data-highlight-id={req.id}
                  data-request-id={req.id}
                  style={{ '--status-accent': statusAccentColor(req.status) } as React.CSSProperties}
                  className={`relative status-accent-card bg-white rounded-xl border border-gray-200 shadow-sm p-4 transition-all duration-300 ${
                    isHighlighted ? 'premium-highlight-card' : ''
                  }`}
                >
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
          });
        })()}
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
