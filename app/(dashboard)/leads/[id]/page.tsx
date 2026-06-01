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

// Pipeline stages in order
const PIPELINE_STAGES = [
  { key: 'SUSPECT',     label: 'Suspect',     color: 'bg-indigo-500', light: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
  { key: 'PROSPECT',    label: 'Prospect',    color: 'bg-cyan-500',   light: 'bg-cyan-50 border-cyan-200 text-cyan-700' },
  { key: 'NEGOTIATION', label: 'Negotiation', color: 'bg-orange-500', light: 'bg-orange-50 border-orange-200 text-orange-700' },
  { key: 'COMMIT',      label: 'Commit',      color: 'bg-blue-500',   light: 'bg-blue-50 border-blue-200 text-blue-700' },
  { key: 'WON',         label: 'Won',         color: 'bg-green-500',  light: 'bg-green-50 border-green-200 text-green-700' },
];

// Terminal statuses not in the progression pipeline
const TERMINAL_STATUSES: Record<string, { label: string; color: string }> = {
  LOST:      { label: 'Lost',      color: 'bg-red-100 text-red-700 border-red-200' },
  DROPPED:   { label: 'Dropped',   color: 'bg-gray-100 text-gray-600 border-gray-200' },
  ON_HOLD:   { label: 'On Hold',   color: 'bg-amber-100 text-amber-700 border-amber-200' },
  REJECTED:  { label: 'Rejected',  color: 'bg-red-200 text-red-800 border-red-300' },
  CONVERTED: { label: 'Converted', color: 'bg-purple-100 text-purple-700 border-purple-200' },
};

const FOLLOWUP_TYPES = ['CALL', 'EMAIL', 'MEETING', 'DEMO', 'PROPOSAL', 'NEGOTIATION', 'OTHER'];

// ─── Pipeline Strip Component ────────────────────────────────────────────────
function PipelineStrip({
  currentStatus,
  canEdit,
  onStageClick,
}: {
  currentStatus: string;
  canEdit: boolean;
  onStageClick: (stage: string) => void;
}) {
  const activeIdx = PIPELINE_STAGES.findIndex(s => s.key === currentStatus);
  const isTerminal = currentStatus in TERMINAL_STATUSES;

  return (
    <div className="bg-white border rounded-xl p-5 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">Pipeline Stage</h2>
        {isTerminal && (
          <span className={`text-xs px-3 py-1 rounded-full border font-medium ${TERMINAL_STATUSES[currentStatus]?.color}`}>
            {TERMINAL_STATUSES[currentStatus]?.label}
          </span>
        )}
      </div>

      {/* Stage track */}
      <div className="flex items-stretch gap-1">
        {PIPELINE_STAGES.map((stage, idx) => {
          const isActive = stage.key === currentStatus;
          const isPast = !isTerminal && activeIdx > idx;
          const isFuture = isTerminal ? true : activeIdx < idx;

          // Active stage gets more width dynamically
          const widthClass = isActive
            ? 'flex-[2.5] min-w-0'
            : 'flex-1 min-w-0';

          return (
            <button
              key={stage.key}
              onClick={() => canEdit && onStageClick(stage.key)}
              disabled={!canEdit}
              title={canEdit ? `Move to ${stage.label}` : stage.label}
              className={`
                ${widthClass} relative flex flex-col items-center justify-center
                rounded-lg border-2 py-3 px-2 transition-all duration-300
                ${isActive
                  ? `${stage.color} border-transparent text-white shadow-lg scale-105`
                  : isPast
                  ? 'bg-gray-100 border-gray-200 text-gray-500'
                  : 'bg-gray-50 border-gray-100 text-gray-400 hover:bg-gray-100'}
                ${canEdit && !isActive ? 'cursor-pointer' : 'cursor-default'}
              `}
            >
              {/* Tick for past stages */}
              {isPast && (
                <span className="text-gray-400 text-xs mb-0.5">✓</span>
              )}

              <span className={`font-semibold text-center leading-tight ${isActive ? 'text-sm' : 'text-xs'}`}>
                {stage.label}
              </span>

              {isActive && (
                <span className="text-xs mt-1 opacity-80 font-normal">Current</span>
              )}

              {/* Connector arrow */}
              {idx < PIPELINE_STAGES.length - 1 && (
                <span className="absolute -right-1 top-1/2 -translate-y-1/2 z-10 text-gray-300 text-xs">▶</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Quick stage buttons if terminal */}
      {isTerminal && canEdit && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-2">Re-open pipeline:</p>
          <div className="flex gap-2 flex-wrap">
            {PIPELINE_STAGES.map(s => (
              <button
                key={s.key}
                onClick={() => onStageClick(s.key)}
                className={`text-xs px-3 py-1 rounded-full border ${s.light} hover:opacity-80 transition-opacity`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Terminal quick-set buttons */}
      {!isTerminal && canEdit && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2 flex-wrap">
          {Object.entries(TERMINAL_STATUSES).filter(([k]) => k !== 'CONVERTED').map(([key, val]) => (
            <button
              key={key}
              onClick={() => onStageClick(key)}
              className={`text-xs px-3 py-1 rounded-full border ${val.color} hover:opacity-80 transition-opacity`}
            >
              Mark {val.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function LeadDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [stageChanging, setStageChanging] = useState(false);

  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpForm, setFollowUpForm] = useState({ type: 'CALL', scheduledDate: '', notes: '', outcome: '' });
  const [savingFollowUp, setSavingFollowUp] = useState(false);

  const [editData, setEditData] = useState({
    status: '', qualificationNotes: '', remarks: '',
    quoteNo: '', quoteValue: '', rfqDate: '', followUpDate: '',
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(u => setCurrentUser(u)).catch(console.error);
    fetchLead();
  }, [id]);

  const fetchLead = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/leads/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to fetch lead');
      const data = await res.json();
      setLead(data);
      setEditData({
        status: data.status,
        qualificationNotes: data.qualificationNotes || '',
        remarks: data.remarks || '',
        quoteNo: data.quoteNo || '',
        quoteValue: data.quoteValue != null ? String(data.quoteValue) : '',
        rfqDate: data.rfqDate ? data.rfqDate.split('T')[0] : '',
        followUpDate: data.followUpDate ? data.followUpDate.split('T')[0] : '',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const canEdit = !!(currentUser && (
    ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER'].includes(currentUser.role) ||
    lead?.assignedTo?.id === currentUser.id
  ));

  const handleStageClick = async (newStatus: string) => {
    if (!lead || stageChanging) return;
    setStageChanging(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update stage');
      const updated = await res.json();
      setLead(prev => prev ? { ...prev, status: updated.status } : null);
      setEditData(prev => ({ ...prev, status: updated.status }));
    } catch (err) {
      console.error(err);
      alert('Failed to update stage.');
    } finally {
      setStageChanging(false);
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
        body: JSON.stringify({ companyName: lead.company, gstNumber: `PENDING-${Date.now()}`, industry: 'Other' }),
      });
      if (!res.ok) { const e = await res.json(); alert(`Failed: ${e.message || 'Error'}`); return; }
      const customer = await res.json();
      await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'CONVERTED', linkedCustomerId: customer.id }),
      });
      setShowConvertModal(false);
      fetchLead();
      alert(`"${lead.company}" converted to customer!`);
      router.push('/customers');
    } catch (err) {
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
      if (res.ok) { alert('Deletion request submitted for approval.'); router.push('/leads'); }
      else { const e = await res.json(); alert(e.message || 'Failed'); }
    } catch (err) {
      alert('An error occurred.');
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleAddFollowUp = async () => {
    if (!followUpForm.scheduledDate) { alert('Please select a scheduled date.'); return; }
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
      if (!res.ok) { const e = await res.json(); alert(`Failed: ${e.message}`); return; }
      setShowFollowUpModal(false);
      setFollowUpForm({ type: 'CALL', scheduledDate: '', notes: '', outcome: '' });
      fetchLead();
    } catch (err) {
      alert('An error occurred.');
    } finally {
      setSavingFollowUp(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-500">Loading lead...</p>
      </div>
    </div>
  );
  if (!lead) return <div className="p-6 text-center text-gray-500">Lead not found</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/leads" className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
          ← Back
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">{lead.name}</h1>
          <p className="text-sm text-gray-500">{lead.company} · {lead.source}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => setShowFollowUpModal(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700">
            + Follow-up
          </button>
          {canEdit && (
            <button onClick={() => setEditing(!editing)}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg font-medium hover:bg-gray-50">
              {editing ? 'Cancel' : 'Edit'}
            </button>
          )}
        </div>
      </div>

      {/* Pipeline Strip — full width, prominent */}
      <PipelineStrip
        currentStatus={lead.status}
        canEdit={canEdit && !stageChanging}
        onStageClick={handleStageClick}
      />
      {stageChanging && (
        <p className="text-xs text-blue-500 text-center -mt-4 mb-4">Updating stage...</p>
      )}

      {/* Body */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left: details */}
        <div className="col-span-2 space-y-5">

          {/* Lead Info */}
          <div className="bg-white rounded-xl border p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Lead Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Opportunity</p>
                <p className="font-medium text-gray-800">{lead.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Company</p>
                <p className="font-medium text-gray-800">{lead.company}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Email</p>
                <p className="text-gray-700">{lead.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Phone</p>
                <p className="text-gray-700">{lead.phone || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Source</p>
                <p className="text-gray-700">{lead.source}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Lead Score</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${lead.leadScore}%` }} />
                  </div>
                  <span className="text-sm font-bold text-blue-600">{lead.leadScore}</span>
                </div>
              </div>
              {lead.remarks && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Remarks</p>
                  <p className="text-gray-700">{lead.remarks}</p>
                </div>
              )}
            </div>
          </div>

          {/* Edit Form */}
          {editing && (
            <div className="bg-white rounded-xl border border-blue-200 p-5 shadow-sm">
              <h2 className="text-base font-semibold text-gray-800 mb-4">Edit Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Qualification Notes</label>
                  <textarea
                    value={editData.qualificationNotes}
                    onChange={e => setEditData({ ...editData, qualificationNotes: e.target.value })}
                    placeholder="Budget, Authority, Need, Timeline..."
                    className="w-full h-20 border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Quote No.</label>
                    <input type="text" value={editData.quoteNo}
                      onChange={e => setEditData({ ...editData, quoteNo: e.target.value })}
                      placeholder="QT-2024-001" className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Quote Value (₹)</label>
                    <input type="number" value={editData.quoteValue}
                      onChange={e => setEditData({ ...editData, quoteValue: e.target.value })}
                      placeholder="0" className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">RFQ Date</label>
                    <input type="date" value={editData.rfqDate}
                      onChange={e => setEditData({ ...editData, rfqDate: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Follow-up Date</label>
                    <input type="date" value={editData.followUpDate}
                      onChange={e => setEditData({ ...editData, followUpDate: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Remarks</label>
                  <textarea value={editData.remarks}
                    onChange={e => setEditData({ ...editData, remarks: e.target.value })}
                    placeholder="Any additional notes..."
                    className="w-full h-16 border rounded-lg px-3 py-2 text-sm" />
                </div>
                <button onClick={handleUpdate}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700">
                  Save Changes
                </button>
              </div>
            </div>
          )}

          {/* Qualification Notes (view mode) */}
          {!editing && lead.qualificationNotes && (
            <div className="bg-white rounded-xl border p-5 shadow-sm">
              <h2 className="text-base font-semibold text-gray-800 mb-2">Qualification Notes</h2>
              <p className="text-gray-700 text-sm">{lead.qualificationNotes}</p>
            </div>
          )}

          {/* Follow-ups */}
          <div className="bg-white rounded-xl border p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-800">Follow-up History</h2>
              <button onClick={() => setShowFollowUpModal(true)}
                className="text-xs text-blue-600 hover:underline font-medium">
                + Add
              </button>
            </div>
            {!lead.followUps || lead.followUps.length === 0 ? (
              <p className="text-sm text-gray-400 py-3 text-center">No follow-ups yet</p>
            ) : (
              <div className="space-y-3">
                {lead.followUps.map(fu => (
                  <div key={fu.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
                      {fu.type.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800">{fu.type}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(fu.scheduledDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      {fu.notes && <p className="text-xs text-gray-500 mt-0.5">{fu.notes}</p>}
                    </div>
                    {fu.outcome && (
                      <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-100 flex-shrink-0">
                        {fu.outcome}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: sidebar */}
        <div className="space-y-4">

          {/* Quote / Commercial */}
          <div className="bg-white rounded-xl border p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Commercial</h3>
            <div className="space-y-3">
              {lead.quoteNo ? (
                <div>
                  <p className="text-xs text-gray-400 uppercase mb-0.5">Quote No</p>
                  <p className="text-sm font-mono font-medium text-gray-800">{lead.quoteNo}</p>
                </div>
              ) : null}
              {lead.quoteValue ? (
                <div>
                  <p className="text-xs text-gray-400 uppercase mb-0.5">Quote Value</p>
                  <p className="text-lg font-bold text-green-700">
                    ₹{Number(lead.quoteValue).toLocaleString('en-IN')}
                  </p>
                </div>
              ) : null}
              {lead.rfqDate ? (
                <div>
                  <p className="text-xs text-gray-400 uppercase mb-0.5">RFQ Date</p>
                  <p className="text-sm text-gray-700">{new Date(lead.rfqDate).toLocaleDateString('en-IN')}</p>
                </div>
              ) : null}
              {lead.followUpDate ? (
                <div>
                  <p className="text-xs text-gray-400 uppercase mb-0.5">Next Follow-up</p>
                  <p className={`text-sm font-medium ${new Date(lead.followUpDate) < new Date() ? 'text-red-600' : 'text-gray-700'}`}>
                    {new Date(lead.followUpDate).toLocaleDateString('en-IN')}
                    {new Date(lead.followUpDate) < new Date() && ' (overdue)'}
                  </p>
                </div>
              ) : null}
              {!lead.quoteNo && !lead.quoteValue && !lead.rfqDate && !lead.followUpDate && (
                <p className="text-xs text-gray-400 text-center py-2">No commercial data yet</p>
              )}
            </div>
          </div>

          {/* People */}
          <div className="bg-white rounded-xl border p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">People</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-400 uppercase mb-1">Assigned To</p>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {lead.assignedTo.firstName.charAt(0)}{lead.assignedTo.lastName.charAt(0)}
                  </div>
                  <span className="text-sm font-medium text-gray-800">{lead.assignedTo.firstName} {lead.assignedTo.lastName}</span>
                </div>
              </div>
              {lead.broughtBy && (
                <div>
                  <p className="text-xs text-gray-400 uppercase mb-1">Sourced By</p>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {lead.broughtBy.firstName.charAt(0)}{lead.broughtBy.lastName.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-gray-800">{lead.broughtBy.firstName} {lead.broughtBy.lastName}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Timeline</h3>
            <p className="text-xs text-gray-400 uppercase mb-0.5">Created</p>
            <p className="text-sm text-gray-700">{new Date(lead.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            {lead.linkedCustomer ? (
              <Link href={`/customers/${lead.linkedCustomer.id}`}
                className="w-full block text-center py-2 px-4 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm font-medium hover:bg-purple-100">
                View Customer →
              </Link>
            ) : canEdit && ['PROSPECT', 'NEGOTIATION', 'COMMIT', 'WON'].includes(lead.status) ? (
              <button onClick={() => setShowConvertModal(true)}
                className="w-full py-2 px-4 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-medium hover:bg-green-100">
                Convert to Customer
              </button>
            ) : canEdit ? (
              <div className="text-xs text-gray-400 text-center px-2 py-2 bg-gray-50 rounded-lg border border-gray-100">
                Advance to <strong>Prospect</strong> to convert
              </div>
            ) : null}

            {canEdit && (
              <button onClick={() => setShowDeleteModal(true)}
                className="w-full py-2 px-4 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50">
                Request Deletion
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Convert Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold mb-3">Convert to Customer?</h2>
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="font-semibold text-gray-800">{lead.company}</p>
              <p className="text-sm text-gray-500">{lead.name} · {lead.email}</p>
            </div>
            <p className="text-xs text-gray-400 mb-5">Lead status will be set to <strong>CONVERTED</strong> and linked to a new customer record.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConvertModal(false)} disabled={converting}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleConvertToCustomer} disabled={converting}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {converting ? 'Converting...' : 'Yes, Convert'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Follow-up Modal */}
      {showFollowUpModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-4">Add Follow-up</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select value={followUpForm.type} onChange={e => setFollowUpForm({ ...followUpForm, type: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  {FOLLOWUP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Scheduled Date <span className="text-red-500">*</span></label>
                <input type="datetime-local" value={followUpForm.scheduledDate}
                  onChange={e => setFollowUpForm({ ...followUpForm, scheduledDate: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea value={followUpForm.notes} onChange={e => setFollowUpForm({ ...followUpForm, notes: e.target.value })}
                  placeholder="What will you discuss?" className="w-full border rounded-lg px-3 py-2 text-sm h-20" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Outcome (optional)</label>
                <input type="text" value={followUpForm.outcome}
                  onChange={e => setFollowUpForm({ ...followUpForm, outcome: e.target.value })}
                  placeholder="e.g. Interested, Call back next week"
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowFollowUpModal(false)} disabled={savingFollowUp}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleAddFollowUp} disabled={savingFollowUp}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {savingFollowUp ? 'Saving...' : 'Add Follow-up'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold mb-3 text-red-600">Request Lead Deletion?</h2>
            <p className="text-sm text-gray-600 mb-4">This request goes to your manager for approval.</p>
            <textarea value={deleteReason} onChange={e => setDeleteReason(e.target.value)}
              placeholder="Reason for deletion (optional)..."
              className="w-full border rounded-lg px-3 py-2 text-sm h-20 mb-4" />
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteModal(false); setDeleteReason(''); }} disabled={deleting}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleDeleteRequest} disabled={deleting}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                {deleting ? 'Submitting...' : 'Submit for Approval'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
