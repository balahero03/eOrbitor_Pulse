'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface LeadDetail {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company: string;
  source: string;
  status: string;
  leadScore: number;
  qualificationNotes?: string;
  remarks?: string;
  quoteNo?: string;
  quoteValue?: number;
  rfqDate?: string;
  followUpDate?: string;
  assignedTo: { id: string; firstName: string; lastName: string };
  broughtBy?: { id: string; firstName: string; lastName: string };
  linkedCustomer?: { id: string; companyName: string };
  followUps?: Array<{ id: string; type: string; scheduledDate: string; outcome?: string; notes?: string }>;
  createdAt: string;
}

const FOLLOWUP_TYPES = ['CALL', 'EMAIL', 'MEETING', 'DEMO', 'PROPOSAL', 'NEGOTIATION', 'OTHER'];

export default function LeadDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [converting, setConverting] = useState(false);

  // Convert modal
  const [showConvertModal, setShowConvertModal] = useState(false);

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Follow-up modal
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpForm, setFollowUpForm] = useState({
    type: 'CALL',
    scheduledDate: '',
    notes: '',
    outcome: '',
  });
  const [savingFollowUp, setSavingFollowUp] = useState(false);

  const [editData, setEditData] = useState({
    status: '',
    qualificationNotes: '',
    remarks: '',
    quoteNo: '',
    quoteValue: '',
    rfqDate: '',
    followUpDate: '',
  });

  useEffect(() => { fetchLead(); }, [id]);

  const fetchLead = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/leads/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch lead');
      const data = await res.json();
      setLead(data);
      setEditData({
        status: data.status,
        qualificationNotes: data.qualificationNotes || '',
        remarks: data.remarks || '',
        quoteNo: data.quoteNo || '',
        quoteValue: data.quoteValue !== undefined && data.quoteValue !== null ? String(data.quoteValue) : '',
        rfqDate: data.rfqDate ? data.rfqDate.split('T')[0] : '',
        followUpDate: data.followUpDate ? data.followUpDate.split('T')[0] : '',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(editData),
      });
      if (!res.ok) throw new Error('Failed to update lead');
      const updated = await res.json();
      setLead(prev => prev ? { ...prev, ...updated, followUps: prev.followUps } : null);
      setEditing(false);
    } catch (err) {
      console.error(err);
      alert('Failed to save changes.');
    }
  };

  const handleConvertToCustomer = async () => {
    if (!lead) return;
    setConverting(true);
    try {
      const token = localStorage.getItem('token');

      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          companyName: lead.company,
          gstNumber: `PENDING-${Date.now()}`,
          industry: 'Other',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(`Failed to convert: ${err.message || 'Unknown error'}`);
        return;
      }

      const customer = await res.json();

      await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'CONVERTED', linkedCustomerId: customer.id }),
      });

      setShowConvertModal(false);
      fetchLead();
      alert(`"${lead.company}" has been converted to a customer successfully!`);
      router.push('/customers');
    } catch (err) {
      console.error(err);
      alert('An error occurred during conversion.');
    } finally {
      setConverting(false);
    }
  };

  const handleDeleteRequest = async () => {
    setDeleting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/leads/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: deleteReason }),
      });

      if (res.ok) {
        alert('Deletion request submitted for approval.');
        router.push('/leads');
      } else {
        const err = await res.json();
        alert(err.message || 'Failed to submit deletion request');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred while submitting deletion request');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleAddFollowUp = async () => {
    if (!followUpForm.scheduledDate) {
      alert('Please select a scheduled date.');
      return;
    }
    setSavingFollowUp(true);
    try {
      const token = localStorage.getItem('token');

      const res = await fetch(`/api/leads/${id}/followups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: followUpForm.type,
          scheduledDate: new Date(followUpForm.scheduledDate).toISOString(),
          notes: followUpForm.notes,
          outcome: followUpForm.outcome,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(`Failed to add follow-up: ${err.message || 'Unknown error'}`);
        return;
      }

      setShowFollowUpModal(false);
      setFollowUpForm({ type: 'CALL', scheduledDate: '', notes: '', outcome: '' });
      fetchLead();
    } catch (err) {
      console.error(err);
      alert('An error occurred while adding follow-up.');
    } finally {
      setSavingFollowUp(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'WON': return 'bg-green-100 text-green-800';
      case 'LOST': return 'bg-red-100 text-red-800';
      case 'CONVERTED': return 'bg-purple-100 text-purple-800';
      case 'NEGOTIATION': return 'bg-orange-100 text-orange-800';
      case 'COMMIT': return 'bg-blue-100 text-blue-800';
      case 'PROSPECT': return 'bg-cyan-100 text-cyan-800';
      case 'SUSPECT': return 'bg-indigo-100 text-indigo-800';
      case 'QUALIFIED': return 'bg-teal-100 text-teal-800';
      case 'CONTACTED': return 'bg-yellow-100 text-yellow-800';
      case 'DROPPED': return 'bg-gray-100 text-gray-600';
      case 'ON_HOLD': return 'bg-amber-100 text-amber-800';
      case 'REJECTED': return 'bg-red-200 text-red-900';
      default: return 'bg-blue-50 text-blue-700';
    }
  };

  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (!lead) return <div className="p-6 text-center">Lead not found</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">{lead.name}</h1>
        <Link href="/leads" className="btn btn-secondary">Back to Leads</Link>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="col-span-2 space-y-4">
          <div className="card p-6">
            <h2 className="text-lg font-bold mb-4">Lead Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Opportunity</p>
                <p className="font-medium">{lead.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Company</p>
                <p className="font-medium">{lead.company}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Email</p>
                <p className="font-medium">{lead.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Phone</p>
                <p className="font-medium">{lead.phone || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Source</p>
                <p className="font-medium">{lead.source}</p>
              </div>
              {lead.remarks && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-500 uppercase font-semibold">Remarks</p>
                  <p className="font-medium text-gray-700">{lead.remarks}</p>
                </div>
              )}
            </div>
          </div>

          {/* Status & Qualification */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Status & Qualification</h2>
              <button onClick={() => setEditing(!editing)} className="btn btn-secondary text-sm">
                {editing ? 'Cancel' : 'Edit'}
              </button>
            </div>

            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    value={editData.status}
                    onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="SUSPECT">Suspect</option>
                    <option value="PROSPECT">Prospect</option>
                    <option value="NEGOTIATION">Negotiation</option>
                    <option value="WON">Won</option>
                    <option value="LOST">Lost</option>
                    <option value="DROPPED">Dropped</option>
                    <option value="ON_HOLD">On Hold</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Qualification Notes</label>
                  <textarea
                    value={editData.qualificationNotes}
                    onChange={(e) => setEditData({ ...editData, qualificationNotes: e.target.value })}
                    placeholder="Budget, Authority, Need, Timeline..."
                    className="w-full h-20 border rounded px-3 py-2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Quote No.</label>
                    <input
                      type="text"
                      value={editData.quoteNo}
                      onChange={(e) => setEditData({ ...editData, quoteNo: e.target.value })}
                      placeholder="QT-2024-001"
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Quote Value (₹)</label>
                    <input
                      type="number"
                      value={editData.quoteValue}
                      onChange={(e) => setEditData({ ...editData, quoteValue: e.target.value })}
                      placeholder="0"
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">RFQ Date</label>
                    <input
                      type="date"
                      value={editData.rfqDate}
                      onChange={(e) => setEditData({ ...editData, rfqDate: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Follow-Up Date</label>
                    <input
                      type="date"
                      value={editData.followUpDate}
                      onChange={(e) => setEditData({ ...editData, followUpDate: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Remarks</label>
                  <textarea
                    value={editData.remarks}
                    onChange={(e) => setEditData({ ...editData, remarks: e.target.value })}
                    placeholder="Any additional notes..."
                    className="w-full h-16 border rounded px-3 py-2"
                  />
                </div>
                <button onClick={handleUpdate} className="btn btn-primary w-full">Save Changes</button>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Status</p>
                  <span className={`px-3 py-1 rounded font-medium text-sm ${getStatusColor(lead.status)}`}>
                    {lead.status}
                  </span>
                </div>
                {lead.qualificationNotes && (
                  <div className="mt-4">
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Qualification Notes</p>
                    <p className="text-gray-700">{lead.qualificationNotes}</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Recent Follow-ups */}
          <div className="card p-6">
            <h2 className="text-lg font-bold mb-4">Recent Follow-ups</h2>
            {!lead.followUps || lead.followUps.length === 0 ? (
              <p className="text-gray-600">No follow-ups yet</p>
            ) : (
              <div className="space-y-3">
                {lead.followUps.map((fu) => (
                  <div key={fu.id} className="flex items-start gap-4 p-3 bg-gray-50 rounded">
                    <div className="flex-1">
                      <p className="font-medium">{fu.type}</p>
                      <p className="text-sm text-gray-600">{new Date(fu.scheduledDate).toLocaleDateString()}</p>
                      {fu.notes && <p className="text-sm text-gray-500 mt-1">{fu.notes}</p>}
                    </div>
                    {fu.outcome && (
                      <div className="text-sm text-green-700 bg-green-50 px-2 py-1 rounded">{fu.outcome}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Lead Score</h3>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div className="bg-blue-600 h-3 rounded-full" style={{ width: `${lead.leadScore}%` }} />
                </div>
              </div>
              <div className="text-3xl font-bold">{lead.leadScore}</div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Assigned To</h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                {lead.assignedTo.firstName.charAt(0)}{lead.assignedTo.lastName.charAt(0)}
              </div>
              <p className="font-medium">{lead.assignedTo.firstName} {lead.assignedTo.lastName}</p>
            </div>
          </div>

          {/* Lead Manager Card */}
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Lead Management</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-400 uppercase mb-1">Sourced By</p>
                {lead.broughtBy ? (
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {lead.broughtBy.firstName.charAt(0)}{lead.broughtBy.lastName.charAt(0)}
                    </div>
                    <span className="text-sm font-medium">{lead.broughtBy.firstName} {lead.broughtBy.lastName}</span>
                  </div>
                ) : <p className="text-sm text-gray-400">Not assigned</p>}
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase mb-1">Assigned To</p>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {lead.assignedTo.firstName.charAt(0)}{lead.assignedTo.lastName.charAt(0)}
                  </div>
                  <span className="text-sm font-medium">{lead.assignedTo.firstName} {lead.assignedTo.lastName}</span>
                </div>
              </div>
              {lead.quoteNo && (
                <div>
                  <p className="text-xs text-gray-400 uppercase mb-1">Quote No</p>
                  <p className="text-sm font-mono font-medium">{lead.quoteNo}</p>
                </div>
              )}
              {lead.quoteValue && (
                <div>
                  <p className="text-xs text-gray-400 uppercase mb-1">Quote Value</p>
                  <p className="text-sm font-semibold text-green-700">₹{Number(lead.quoteValue).toLocaleString('en-IN')}</p>
                </div>
              )}
              {lead.rfqDate && (
                <div>
                  <p className="text-xs text-gray-400 uppercase mb-1">RFQ Date</p>
                  <p className="text-sm">{new Date(lead.rfqDate).toLocaleDateString('en-IN')}</p>
                </div>
              )}
              {lead.followUpDate && (
                <div>
                  <p className="text-xs text-gray-400 uppercase mb-1">Follow-up Date</p>
                  <p className="text-sm">{new Date(lead.followUpDate).toLocaleDateString('en-IN')}</p>
                </div>
              )}
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Created</h3>
            <p className="text-sm">{new Date(lead.createdAt).toLocaleDateString('en-IN')}</p>
          </div>

          <div className="space-y-2">
            <button onClick={() => setShowFollowUpModal(true)} className="btn btn-primary w-full">
              + Add Follow-up
            </button>
            {lead.linkedCustomer ? (
              <div className="space-y-2">
                <Link href={`/customers/${lead.linkedCustomer.id}`} className="btn btn-secondary w-full block text-center">
                  View Customer
                </Link>
                <button onClick={() => setShowConvertModal(true)} className="btn btn-secondary w-full text-sm">
                  Re-convert / Update Customer
                </button>
              </div>
            ) : ['PROSPECT', 'NEGOTIATION', 'WON'].includes(lead.status) ? (
              <button onClick={() => setShowConvertModal(true)} className="btn btn-secondary w-full">
                Convert to Customer
              </button>
            ) : (
              <div className="text-xs text-gray-400 text-center px-2 py-2 bg-gray-50 rounded border border-gray-200">
                Advance to <strong>Prospect</strong> to convert to customer
              </div>
            )}
            <button onClick={() => setShowDeleteModal(true)} className="btn btn-error w-full">
              🗑️ Request Deletion
            </button>
          </div>
        </div>
      </div>

      {/* Convert to Customer Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold mb-3">Convert to Customer?</h2>
            <p className="text-sm text-gray-600 mb-1">
              This will create a new customer record for:
            </p>
            <div className="bg-gray-50 rounded p-3 mb-5">
              <p className="font-semibold text-gray-800">{lead.company}</p>
              <p className="text-sm text-gray-500">{lead.name} · {lead.email}</p>
            </div>
            <p className="text-xs text-gray-400 mb-5">
              The lead status will be updated to <strong>CONVERTED</strong> and linked to the new customer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConvertModal(false)}
                className="btn btn-secondary flex-1"
                disabled={converting}
              >
                Cancel
              </button>
              <button
                onClick={handleConvertToCustomer}
                className="btn btn-primary flex-1 disabled:opacity-50"
                disabled={converting}
              >
                {converting ? 'Converting...' : 'Yes, Convert'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Follow-up Modal */}
      {showFollowUpModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-4">Add Follow-up</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select
                  value={followUpForm.type}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, type: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                >
                  {FOLLOWUP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Scheduled Date <span className="text-red-500">*</span></label>
                <input
                  type="datetime-local"
                  value={followUpForm.scheduledDate}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, scheduledDate: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={followUpForm.notes}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, notes: e.target.value })}
                  placeholder="What will you discuss?"
                  className="w-full border rounded px-3 py-2 h-20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Outcome (optional)</label>
                <input
                  type="text"
                  value={followUpForm.outcome}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, outcome: e.target.value })}
                  placeholder="e.g. Interested, Call back next week"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowFollowUpModal(false)}
                className="btn btn-secondary flex-1"
                disabled={savingFollowUp}
              >
                Cancel
              </button>
              <button
                onClick={handleAddFollowUp}
                className="btn btn-primary flex-1 disabled:opacity-50"
                disabled={savingFollowUp}
              >
                {savingFollowUp ? 'Saving...' : 'Add Follow-up'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Request Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold mb-3 text-red-600">Request Lead Deletion?</h2>
            <p className="text-sm text-gray-600 mb-4">
              This request will be sent to your manager and admin for approval. They will review and decide whether to delete this lead.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Reason for deletion (optional)</label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="e.g. Duplicate, Wrong contact, No longer interested..."
                className="w-full border rounded px-3 py-2 h-20 text-sm"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteReason('');
                }}
                className="btn btn-secondary flex-1"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteRequest}
                className="btn btn-error flex-1 disabled:opacity-50"
                disabled={deleting}
              >
                {deleting ? 'Submitting...' : 'Submit for Approval'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
