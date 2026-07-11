'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRequireRole } from '@/lib/hooks/useRequireRole';
import { SuccessIcon, ErrorIcon, PendingIcon, UserSingleIcon, ClipboardIcon, CheckGlyph, CloseIcon } from '@/components/icons';

type Status = 'PENDING' | 'APPROVED' | 'REJECTED';

interface ApprovalRequest {
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

const TABS: { key: Status; label: string }[] = [
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

export default function ApprovalsPage() {
  useRequireRole(['SUPER_ADMIN', 'ADMIN', 'BACKEND_TEAM']);
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [counts, setCounts] = useState<Record<Status, number | null>>({ PENDING: null, APPROVED: null, REJECTED: null });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Status>('PENDING');
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
          fetch(`/api/approval-requests?status=${s}&limit=1`, { headers: authHeaders() })
            .then((r) => (r.ok ? r.json() : { pagination: { total: 0 } }))
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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tab, page]);

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
        alert(`Failed to ${status === 'APPROVED' ? 'approve' : 'reject'}: ${err.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message || 'Failed to process request'}`);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Approval Requests</h1>

      {/* Filter tabs — matches the pill style used across the app */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const isActive = tab === t.key;
          const count = counts[t.key];
          return (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-700'
              }`}
            >
              {t.label}
              {count !== null && (
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
          <ClipboardIcon className="w-9 h-9 mx-auto mb-2 text-gray-300" />
          <p className="text-gray-500">No {tab.toLowerCase()} requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const border = req.status === 'PENDING' ? 'border-l-amber-500' : req.status === 'APPROVED' ? 'border-l-green-500' : 'border-l-red-500';
            return (
              <div key={req.id} className={`bg-white rounded-xl border border-gray-200 border-l-4 ${border} shadow-sm p-4`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Title row */}
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <h3 className="font-semibold text-gray-900">{TYPE_LABEL[req.type] || 'Approval Request'}</h3>
                      <StatusPill status={req.status} />
                    </div>

                    {/* Lead / entity line */}
                    {req.lead ? (
                      <p className="text-sm text-gray-700">
                        <span className="font-medium">{req.lead.name}</span>
                        <span className="text-gray-400"> · {req.lead.company}</span>
                        <span className="text-gray-400"> · {req.lead.status}</span>
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500">{req.entityType} · {req.entityId.slice(0, 10)}…</p>
                    )}

                    {/* Meta rows */}
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

                  {/* Actions (pending only) */}
                  {req.status === 'PENDING' && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => decide(req.id, 'APPROVED')}
                        disabled={processingId === req.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-50"
                      >
                        <CheckGlyph className="w-3.5 h-3.5" /> {processingId === req.id ? '…' : 'Approve'}
                      </button>
                      <button
                        onClick={() => setShowRejectForm(showRejectForm === req.id ? null : req.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-red-300 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-50"
                      >
                        <CloseIcon className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  )}
                </div>

                {showRejectForm === req.id && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
                    <input
                      type="text"
                      placeholder="Reason for rejection (optional)"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => decide(req.id, 'REJECTED')}
                        disabled={processingId === req.id}
                        className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
                      >
                        {processingId === req.id ? 'Processing…' : 'Confirm Rejection'}
                      </button>
                      <button
                        onClick={() => { setShowRejectForm(null); setRejectionReason(''); }}
                        className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-3">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
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
