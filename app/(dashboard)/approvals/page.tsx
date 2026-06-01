'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRequireRole } from '@/lib/hooks/useRequireRole';

interface ApprovalRequest {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason?: string;
  rejectionReason?: string;
  createdAt: string;
  requestedByUser: { id: string; firstName: string; lastName: string; email: string };
  approvedByUser?: { id: string; firstName: string; lastName: string };
  lead?: { id: string; name: string; company: string; status: string };
}

export default function ApprovalsPage() {
  useRequireRole(['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER']);
  const router = useRouter();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, [tab]);

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/approval-requests?status=${tab}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch');

      const data = await res.json();
      setRequests(data.requests);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/approval-requests/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'APPROVED' }),
      });

      if (res.ok) {
        setRequests(requests.filter(r => r.id !== id));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/approval-requests/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'REJECTED', rejectionReason }),
      });

      if (res.ok) {
        setRequests(requests.filter(r => r.id !== id));
        setShowRejectForm(null);
        setRejectionReason('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <div className="p-6 text-center">Loading...</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Approval Requests</h1>
      </div>

      <div className="tabs tabs-bordered mb-6">
        <button
          onClick={() => setTab('PENDING')}
          className={`tab ${tab === 'PENDING' ? 'tab-active' : ''}`}
        >
          Pending ({requests.filter(r => r.status === 'PENDING').length})
        </button>
        <button
          onClick={() => setTab('APPROVED')}
          className={`tab ${tab === 'APPROVED' ? 'tab-active' : ''}`}
        >
          Approved
        </button>
        <button
          onClick={() => setTab('REJECTED')}
          className={`tab ${tab === 'REJECTED' ? 'tab-active' : ''}`}
        >
          Rejected
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-gray-500">
          No {tab.toLowerCase()} requests
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 border-l-4 border-blue-500">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-lg">Delete Lead Request</h3>
                    <span className={`badge ${
                      req.status === 'PENDING' ? 'badge-warning' :
                      req.status === 'APPROVED' ? 'badge-success' :
                      'badge-error'
                    }`}>
                      {req.status}
                    </span>
                  </div>

                  {req.lead && (
                    <div className="mb-3 p-3 bg-gray-50 rounded">
                      <p className="text-sm"><strong>Lead:</strong> {req.lead.name}</p>
                      <p className="text-sm"><strong>Company:</strong> {req.lead.company}</p>
                      <p className="text-sm"><strong>Status:</strong> {req.lead.status}</p>
                    </div>
                  )}

                  <p className="text-sm text-gray-600 mb-2">
                    <strong>Requested by:</strong> {req.requestedByUser.firstName} {req.requestedByUser.lastName}
                  </p>

                  {req.reason && (
                    <p className="text-sm text-gray-600 mb-2">
                      <strong>Reason:</strong> {req.reason}
                    </p>
                  )}

                  {req.rejectionReason && (
                    <p className="text-sm text-red-600 mb-2">
                      <strong>Rejection reason:</strong> {req.rejectionReason}
                    </p>
                  )}

                  {req.approvedByUser && (
                    <p className="text-sm text-gray-600">
                      <strong>Approved by:</strong> {req.approvedByUser.firstName} {req.approvedByUser.lastName}
                    </p>
                  )}

                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(req.createdAt).toLocaleString()}
                  </p>
                </div>

                {tab === 'PENDING' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(req.id)}
                      disabled={processingId === req.id}
                      className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700"
                    >
                      {processingId === req.id ? 'Processing...' : 'Approve'}
                    </button>
                    <button
                      onClick={() => setShowRejectForm(showRejectForm === req.id ? null : req.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>

              {showRejectForm === req.id && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded space-y-3">
                  <input
                    type="text"
                    placeholder="Reason for rejection (optional)"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReject(req.id)}
                      disabled={processingId === req.id}
                      className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700"
                    >
                      {processingId === req.id ? 'Processing...' : 'Confirm Rejection'}
                    </button>
                    <button
                      onClick={() => {
                        setShowRejectForm(null);
                        setRejectionReason('');
                      }}
                      className="px-3 py-1 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
