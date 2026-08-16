export type ApprovalTab = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ApprovalLocation {
  /** Which tab the record is actually sitting in right now. */
  tab: ApprovalTab;
  /** The id the approvals page keys its cards on. */
  highlightId: string;
  /** The matched request itself, for callers that need more than the status. */
  raw: any;
}

/**
 * Where an approval request lives *now*.
 *
 * A notification is a record of something that was true when it was sent. By
 * the time it is clicked another admin may have already approved or rejected
 * the same request — and the notification itself is not removed when that
 * happens, so this is the ordinary case rather than a rare race. Sending the
 * user to the Pending tab because the notification said "requested" then shows
 * them an empty list and no explanation.
 *
 * So the status is re-read at click time and the destination built from the
 * answer, rather than from what the notification remembers.
 *
 * The lookup is deliberately forgiving about which id it is given: a
 * notification carries the *entity* id (the lead, order or customer), while
 * the request has its own id, and `?id=` on the API matches any of id,
 * entityId or leadId.
 */
export async function resolveApprovalLocation(
  id: string,
  kind: 'record' | 'access',
): Promise<ApprovalLocation | null> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (!token) return null;

  const url =
    kind === 'access'
      ? `/api/access-requests?id=${encodeURIComponent(id)}&status=ALL`
      : `/api/approval-requests?id=${encodeURIComponent(id)}&status=ALL`;

  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const data = await res.json();
    const list: any[] = data?.requests ?? [];
    if (!list.length) return null;

    // Newest first. The same entity can carry more than one request over its
    // life — a reopen that was rejected, then a second one that was approved —
    // and the notification that was just clicked is about the latest of them.
    const sorted = [...list].sort(
      (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
    );
    const match =
      sorted.find((r) => r.entityId === id || r.id === id || r.leadId === id) ?? sorted[0];

    const status = String(match?.status ?? '').toUpperCase();
    if (status !== 'PENDING' && status !== 'APPROVED' && status !== 'REJECTED') return null;

    return {
      tab: status,
      // Cards are keyed on the entity for record requests and on the request's
      // own id for access requests — mirroring how each page renders them.
      highlightId: kind === 'access' ? match.id : (match.entityId ?? match.leadId ?? match.id),
      raw: match,
    };
  } catch {
    return null;
  }
}

/** The approvals URL for a resolved location. */
export function approvalsUrl(kind: 'record' | 'access', loc: ApprovalLocation | null, fallbackId?: string): string {
  const params = new URLSearchParams({ category: kind });
  if (loc) {
    params.set('tab', loc.tab);
    params.set('id', loc.highlightId);
  } else if (fallbackId) {
    // Status unknown — send them to the target without forcing a tab, rather
    // than guessing PENDING and landing on a list the record is not in.
    params.set('id', fallbackId);
  }
  // Makes a second click on the same notification a distinct URL, so the page's
  // effects re-run instead of React seeing identical params and doing nothing.
  params.set('n', String(Date.now()));
  return `/approvals?${params.toString()}`;
}
