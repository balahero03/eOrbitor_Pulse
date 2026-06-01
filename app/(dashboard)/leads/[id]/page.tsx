'use client';

import { useState, useEffect, useRef } from 'react';
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
  closedAt?: string;
  closureReason?: string;
  assignedTo: { id: string; firstName: string; lastName: string };
  broughtBy?: { id: string; firstName: string; lastName: string };
  linkedCustomer?: { id: string; companyName: string };
  followUps?: Array<{ id: string; type: string; scheduledDate: string; outcome?: string; notes?: string }>;
  createdAt: string;
}

// S P A N C — the 5 active pipeline stages (ORDER is post-closure, not a kanban column)
const SPANCO = [
  {
    key: 'SUSPECT',
    label: 'Suspect',
    abbr: 'S',
    icon: '🔍',
    headerBg: 'bg-slate-600',
    cardBg: 'bg-slate-50 border-slate-300',
    badge: 'bg-slate-100 text-slate-700',
    desc: 'Potential — not yet contacted',
  },
  {
    key: 'PROSPECT',
    label: 'Prospect',
    abbr: 'P',
    icon: '📋',
    headerBg: 'bg-cyan-600',
    cardBg: 'bg-cyan-50 border-cyan-300',
    badge: 'bg-cyan-100 text-cyan-700',
    desc: 'Qualified and interested',
  },
  {
    key: 'APPROACH',
    label: 'Approach',
    abbr: 'A',
    icon: '📣',
    headerBg: 'bg-indigo-600',
    cardBg: 'bg-indigo-50 border-indigo-300',
    badge: 'bg-indigo-100 text-indigo-700',
    desc: 'Demo or presentation given',
  },
  {
    key: 'NEGOTIATION',
    label: 'Negotiation',
    abbr: 'N',
    icon: '🤝',
    headerBg: 'bg-orange-500',
    cardBg: 'bg-orange-50 border-orange-300',
    badge: 'bg-orange-100 text-orange-700',
    desc: 'Price & terms discussed',
  },
  {
    key: 'CLOSURE',
    label: 'Closure',
    abbr: 'C',
    icon: '🔒',
    headerBg: 'bg-blue-600',
    cardBg: 'bg-blue-50 border-blue-300',
    badge: 'bg-blue-100 text-blue-700',
    desc: 'Ready — click Close Deal to finalise',
  },
];

// Statuses that are closed / off the kanban
const CLOSED_STATUSES: Record<string, { label: string; icon: string; style: string }> = {
  ORDER:   { label: 'Won → Order', icon: '🏆', style: 'bg-green-100 text-green-800 border-green-300' },
  LOST:    { label: 'Lost',        icon: '❌', style: 'bg-red-100 text-red-700 border-red-200' },
  DROPPED: { label: 'Dropped',     icon: '🚫', style: 'bg-gray-100 text-gray-600 border-gray-200' },
  ON_HOLD: { label: 'On Hold',     icon: '⏸️', style: 'bg-amber-100 text-amber-700 border-amber-200' },
};

const FOLLOWUP_TYPES = ['CALL', 'EMAIL', 'MEETING', 'DEMO', 'PROPOSAL', 'NEGOTIATION', 'OTHER'];

const fmt = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

// ─── Kanban Board ────────────────────────────────────────────────────────────
function SpancoKanban({
  lead,
  canEdit,
  onStageChange,
  changing,
  onClosureClick,
}: {
  lead: LeadDetail;
  canEdit: boolean;
  onStageChange: (stage: string) => void;
  changing: boolean;
  onClosureClick: () => void;
}) {
  const [dragOver, setDragOver] = useState<string | null>(null);

  const isClosed = lead.status in CLOSED_STATUSES;
  const activeIdx = SPANCO.findIndex(s => s.key === lead.status);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, stageKey: string) => {
    e.preventDefault();
    setDragOver(null);
    if (stageKey === lead.status || !canEdit || changing) return;
    onStageChange(stageKey);
  };

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      {/* Board title bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-700 tracking-widest">S · P · A · N · C · O</span>
          {isClosed && (
            <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${CLOSED_STATUSES[lead.status]?.style}`}>
              {CLOSED_STATUSES[lead.status]?.icon} {CLOSED_STATUSES[lead.status]?.label}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">
          {changing ? 'Moving…' : canEdit ? 'Click stage or drag card' : ''}
        </span>
      </div>

      {/* 6 Kanban columns */}
      <div className="flex divide-x divide-gray-100 overflow-x-auto" style={{ minHeight: 200 }}>
        {SPANCO.map((stage, idx) => {
          const isActive = stage.key === lead.status;
          const isPast = !isClosed && activeIdx > idx;
          const isDropTarget = dragOver === stage.key && stage.key !== lead.status;
          const isClickable = canEdit && !isActive && !changing;

          return (
            <div
              key={stage.key}
              onDragOver={e => { e.preventDefault(); canEdit && setDragOver(stage.key); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => canEdit && handleDrop(e, stage.key)}
              onClick={() => {
                if (!isClickable) return;
                onStageChange(stage.key);
              }}
              className={`
                flex flex-col transition-all duration-300 min-w-[110px]
                ${isActive ? 'flex-[2]' : 'flex-1'}
                ${isDropTarget ? 'ring-2 ring-inset ring-blue-400 bg-blue-50' : ''}
                ${isClickable ? 'cursor-pointer hover:bg-gray-50' : ''}
              `}
            >
              {/* Column header */}
              <div className={`${stage.headerBg} px-2 py-1.5 flex items-center justify-between`}>
                <span className="text-white text-xs font-semibold truncate">{stage.icon} {stage.label}</span>
                {isPast && <span className="text-white text-xs opacity-70 flex-shrink-0">✓</span>}
                {isActive && <span className="text-white font-black text-xs flex-shrink-0">●</span>}
              </div>

              {/* Column body */}
              <div className="flex-1 flex flex-col items-center p-2 gap-1">
                <p className="text-[10px] text-gray-400 text-center leading-tight mt-0.5">{stage.desc}</p>

                {/* Lead card in active column */}
                {isActive && (
                  <div
                    draggable={canEdit}
                    onDragStart={handleDragStart}
                    className={`
                      w-full rounded-lg border-2 p-2.5 shadow-md mt-1 select-none
                      ${stage.cardBg}
                      ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''}
                      ${changing ? 'opacity-50 animate-pulse' : ''}
                    `}
                  >
                    <div className="flex items-start gap-1 mb-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${stage.badge}`}>
                        {stage.abbr}
                      </span>
                      <p className="text-xs font-bold text-gray-900 leading-tight truncate">{lead.name}</p>
                    </div>
                    <p className="text-[10px] text-gray-500 truncate">{lead.company}</p>
                    {lead.quoteValue ? (
                      <p className="text-xs font-bold text-green-700 mt-1">{fmt(lead.quoteValue)}</p>
                    ) : null}
                    {lead.followUpDate && (
                      <p className={`text-[10px] mt-1 ${new Date(lead.followUpDate) < new Date() ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                        📅 {new Date(lead.followUpDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </p>
                    )}
                    {canEdit && <p className="text-[10px] text-gray-300 mt-1.5">⠿ drag</p>}
                  </div>
                )}

                {/* Drop-zone hint */}
                {!isActive && isDropTarget && (
                  <div className="w-full mt-1 rounded-lg border-2 border-dashed border-blue-400 p-3 text-center text-xs text-blue-500 font-medium">
                    Drop here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick-action footer */}
      {canEdit && !isClosed && (
        <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 font-medium">Mark as:</span>
          {lead.status !== 'ON_HOLD' && (
            <button onClick={() => onStageChange('ON_HOLD')} disabled={changing}
              className="text-xs px-3 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200 hover:opacity-80 disabled:opacity-40">
              ⏸️ On Hold
            </button>
          )}
          {lead.status === 'CLOSURE' && (
            <>
              <button onClick={onClosureClick} disabled={changing}
                className="text-xs px-3 py-1 rounded-full border bg-green-50 text-green-700 border-green-200 hover:opacity-80 disabled:opacity-40">
                ✅ Close Deal
              </button>
            </>
          )}
        </div>
      )}

      {isClosed && canEdit && (
        <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 font-medium">Re-open:</span>
          {SPANCO.map(s => (
            <button key={s.key} onClick={() => onStageChange(s.key)} disabled={changing}
              className={`text-xs px-3 py-1 rounded-full border ${s.badge} hover:opacity-80 disabled:opacity-40`}>
              ↩ {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Closure Outcome Modal ────────────────────────────────────────────────────
function ClosureModal({
  lead,
  onClose,
  onSubmit,
  closing,
}: {
  lead: LeadDetail;
  onClose: () => void;
  onSubmit: (outcome: 'WON' | 'LOST' | 'DROPPED', reason: string) => void;
  closing: boolean;
}) {
  const [outcome, setOutcome] = useState<'WON' | 'LOST' | 'DROPPED'>('WON');
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Close this deal</h2>
          <p className="text-sm text-gray-500 mb-5">
            <strong>{lead.name}</strong> · {lead.company}
            {lead.quoteValue ? ` · ${fmt(lead.quoteValue)}` : ''}
          </p>

          {/* Outcome picker */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { key: 'WON',     label: 'Won',     icon: '🏆', style: 'border-green-400 bg-green-50 text-green-800' },
              { key: 'LOST',    label: 'Lost',    icon: '❌', style: 'border-red-400 bg-red-50 text-red-800' },
              { key: 'DROPPED', label: 'Dropped', icon: '🚫', style: 'border-gray-400 bg-gray-50 text-gray-700' },
            ].map(o => (
              <button
                key={o.key}
                onClick={() => setOutcome(o.key as any)}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 font-medium text-sm transition-all
                  ${outcome === o.key ? o.style + ' scale-105 shadow-md' : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}
              >
                <span className="text-2xl">{o.icon}</span>
                <span>{o.label}</span>
              </button>
            ))}
          </div>

          {/* Win description */}
          {outcome === 'WON' && (
            <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
              <p className="font-semibold mb-1">✅ What happens next:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Lead moves to <strong>Orders</strong> automatically</li>
                <li>Manager & Admin notified by email</li>
                <li>Lead archived in Closed Leads → Won</li>
              </ul>
            </div>
          )}

          {(outcome === 'LOST' || outcome === 'DROPPED') && (
            <div className="mb-4 p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700">
              <p className="font-semibold mb-1">{outcome === 'LOST' ? '❌' : '🚫'} What happens next:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Lead moved to Closed Leads → {outcome === 'LOST' ? 'Lost' : 'Dropped'}</li>
                <li>Manager & Admin notified by email</li>
                <li>You can re-open this lead anytime</li>
              </ul>
            </div>
          )}

          {/* Reason */}
          <div className="mb-5">
            <label className="block text-sm font-medium mb-1">
              Reason <span className="text-gray-400 font-normal">(recommended)</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={
                outcome === 'WON' ? 'e.g. Customer signed agreement on 1st June' :
                outcome === 'LOST' ? 'e.g. Competitor offered lower price' :
                'e.g. Customer paused procurement for 6 months'
              }
              className="w-full border rounded-lg px-3 py-2 text-sm h-20"
            />
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} disabled={closing}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={() => onSubmit(outcome, reason)}
              disabled={closing}
              className={`flex-1 py-2.5 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors
                ${outcome === 'WON' ? 'bg-green-600 hover:bg-green-700' :
                  outcome === 'LOST' ? 'bg-red-600 hover:bg-red-700' :
                  'bg-gray-600 hover:bg-gray-700'}`}
            >
              {closing ? 'Closing…' : `Confirm ${outcome === 'WON' ? '🏆 Won' : outcome === 'LOST' ? '❌ Lost' : '🚫 Dropped'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LeadDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [stageChanging, setStageChanging] = useState(false);
  const [showClosureModal, setShowClosureModal] = useState(false);
  const [closureSubmitting, setClosureSubmitting] = useState(false);

  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpForm, setFollowUpForm] = useState({ type: 'CALL', scheduledDate: '', notes: '', outcome: '' });
  const [savingFollowUp, setSavingFollowUp] = useState(false);

  const [editData, setEditData] = useState({
    qualificationNotes: '', remarks: '',
    quoteNo: '', quoteValue: '', rfqDate: '', followUpDate: '',
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setCurrentUser).catch(console.error);
    fetchLead();
  }, [id]);

  const fetchLead = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/leads/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLead(data);
      setEditData({
        qualificationNotes: data.qualificationNotes || '',
        remarks: data.remarks || '',
        quoteNo: data.quoteNo || '',
        quoteValue: data.quoteValue != null ? String(data.quoteValue) : '',
        rfqDate: data.rfqDate ? data.rfqDate.split('T')[0] : '',
        followUpDate: data.followUpDate ? data.followUpDate.split('T')[0] : '',
      });
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  const canEdit = !!(currentUser && (
    ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER'].includes(currentUser.role) ||
    lead?.assignedTo?.id === currentUser.id
  ));

  const handleStageChange = async (newStatus: string) => {
    if (!lead || stageChanging) return;
    setStageChanging(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      const updated = await res.json();
      setLead(prev => prev ? { ...prev, status: updated.status } : null);
    } catch (err: any) {
      alert(`Failed to update stage: ${err?.message || 'Unknown error'}`);
    } finally {
      setStageChanging(false);
    }
  };

  const handleClosureSumbit = async (outcome: 'WON' | 'LOST' | 'DROPPED', reason: string) => {
    setClosureSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/leads/${id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ outcome, reason }),
      });
      if (!res.ok) {
        const e = await res.json();
        alert(e.message || 'Failed to close lead');
        return;
      }
      setShowClosureModal(false);
      if (outcome === 'WON') {
        router.push('/orders');
      } else {
        router.push('/closed-leads');
      }
    } catch {
      alert('An error occurred.');
    } finally {
      setClosureSubmitting(false);
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
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setLead(prev => prev ? { ...prev, ...updated, followUps: prev.followUps } : null);
      setEditing(false);
    } catch {
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
      if (!res.ok) { const e = await res.json(); alert(`Failed: ${e.message}`); return; }
      const customer = await res.json();
      await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'CONVERTED', linkedCustomerId: customer.id }),
      });
      setShowConvertModal(false);
      fetchLead();
      router.push('/customers');
    } catch { alert('An error occurred.'); }
    finally { setConverting(false); }
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
      if (res.ok) { alert('Deletion request submitted.'); router.push('/leads'); }
      else { const e = await res.json(); alert(e.message || 'Failed'); }
    } catch { alert('An error occurred.'); }
    finally { setDeleting(false); setShowDeleteModal(false); }
  };

  const handleAddFollowUp = async () => {
    if (!followUpForm.scheduledDate) { alert('Please select a date.'); return; }
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
    } catch { alert('An error occurred.'); }
    finally { setSavingFollowUp(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-500">Loading lead…</p>
      </div>
    </div>
  );
  if (!lead) return <div className="p-6 text-center text-gray-500">Lead not found</div>;

  const isClosed = lead.status in CLOSED_STATUSES;

  return (
    <div className="flex flex-col min-h-full">

      {/* ── TOP HALF: kanban board (sticky) ─────────────────────────────── */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 pt-5 pb-5 sticky top-0 z-10 shadow-sm">

        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <Link href="/leads" className="mt-0.5 p-1.5 hover:bg-gray-200 rounded-lg text-gray-500 text-sm flex-shrink-0">
            ← Back
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{lead.name}</h1>
              {isClosed && (
                <Link href="/closed-leads" className="text-xs text-blue-600 hover:underline">
                  View in Closed Leads →
                </Link>
              )}
            </div>
            <p className="text-sm text-gray-500">{lead.company} · {lead.source}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {!isClosed && lead.status === 'CLOSURE' && canEdit && (
              <button
                onClick={() => setShowClosureModal(true)}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg font-semibold hover:bg-blue-700 shadow"
              >
                🔒 Close Deal
              </button>
            )}
            <button onClick={() => setShowFollowUpModal(true)}
              className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg font-medium hover:bg-gray-50">
              + Follow-up
            </button>
            {canEdit && (
              <button onClick={() => setEditing(!editing)}
                className={`px-3 py-1.5 border text-sm rounded-lg font-medium transition-colors ${editing ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}>
                {editing ? 'Cancel' : 'Edit'}
              </button>
            )}
          </div>
        </div>

        {/* SPANCO Kanban Board */}
        <SpancoKanban
          lead={lead}
          canEdit={canEdit}
          onStageChange={handleStageChange}
          changing={stageChanging}
          onClosureClick={() => setShowClosureModal(true)}
        />
      </div>

      {/* ── BOTTOM HALF: details ─────────────────────────────────────────── */}
      <div className="flex-1 px-6 py-5">
        <div className="grid grid-cols-3 gap-6">

          {/* Left 2/3 */}
          <div className="col-span-2 space-y-5">

            {/* Closed banner */}
            {isClosed && (
              <div className={`rounded-xl border p-4 ${
                lead.status === 'ORDER' ? 'bg-green-50 border-green-200' :
                lead.status === 'LOST' ? 'bg-red-50 border-red-200' :
                'bg-gray-50 border-gray-200'
              }`}>
                <p className="text-sm font-semibold text-gray-800">
                  {CLOSED_STATUSES[lead.status]?.icon} This lead is closed — {CLOSED_STATUSES[lead.status]?.label}
                </p>
                {lead.closedAt && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Closed on {new Date(lead.closedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                )}
                {lead.closureReason && (
                  <p className="text-xs text-gray-600 mt-1"><strong>Reason:</strong> {lead.closureReason}</p>
                )}
              </div>
            )}

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
                    <p className="text-gray-700 text-sm">{lead.remarks}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Edit form */}
            {editing && (
              <div className="bg-white rounded-xl border border-blue-200 p-5 shadow-sm">
                <h2 className="text-base font-semibold mb-4">Edit Details</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Qualification Notes</label>
                    <textarea value={editData.qualificationNotes}
                      onChange={e => setEditData({ ...editData, qualificationNotes: e.target.value })}
                      placeholder="Budget, Authority, Need, Timeline…"
                      className="w-full h-20 border rounded-lg px-3 py-2 text-sm" />
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
                      className="w-full h-16 border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <button onClick={handleUpdate}
                    className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700">
                    Save Changes
                  </button>
                </div>
              </div>
            )}

            {/* Qualification Notes (view) */}
            {!editing && lead.qualificationNotes && (
              <div className="bg-white rounded-xl border p-5 shadow-sm">
                <h2 className="text-base font-semibold mb-2">Qualification Notes</h2>
                <p className="text-gray-700 text-sm">{lead.qualificationNotes}</p>
              </div>
            )}

            {/* Follow-ups */}
            <div className="bg-white rounded-xl border p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold">Follow-up History</h2>
                <button onClick={() => setShowFollowUpModal(true)}
                  className="text-xs text-blue-600 hover:underline">+ Add</button>
              </div>
              {!lead.followUps?.length ? (
                <p className="text-sm text-gray-400 text-center py-4">No follow-ups yet</p>
              ) : (
                <div className="space-y-3">
                  {lead.followUps.map(fu => (
                    <div key={fu.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
                        {fu.type.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{fu.type}</span>
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

          {/* Right sidebar */}
          <div className="space-y-4">

            {/* Commercial */}
            <div className="bg-white rounded-xl border p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-600 mb-3">Commercial</h3>
              <div className="space-y-3">
                {lead.quoteNo && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase mb-0.5">Quote No</p>
                    <p className="text-sm font-mono font-medium">{lead.quoteNo}</p>
                  </div>
                )}
                {lead.quoteValue ? (
                  <div>
                    <p className="text-xs text-gray-400 uppercase mb-0.5">Quote Value</p>
                    <p className="text-xl font-bold text-green-700">{fmt(lead.quoteValue)}</p>
                  </div>
                ) : null}
                {lead.rfqDate && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase mb-0.5">RFQ Date</p>
                    <p className="text-sm">{new Date(lead.rfqDate).toLocaleDateString('en-IN')}</p>
                  </div>
                )}
                {lead.followUpDate && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase mb-0.5">Next Follow-up</p>
                    <p className={`text-sm font-medium ${new Date(lead.followUpDate) < new Date() ? 'text-red-600' : 'text-gray-700'}`}>
                      {new Date(lead.followUpDate).toLocaleDateString('en-IN')}
                      {new Date(lead.followUpDate) < new Date() ? ' ⚠️' : ''}
                    </p>
                  </div>
                )}
                {!lead.quoteNo && !lead.quoteValue && !lead.rfqDate && !lead.followUpDate && (
                  <p className="text-xs text-gray-400 text-center py-1">No data yet</p>
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
                    <span className="text-sm font-medium">{lead.assignedTo.firstName} {lead.assignedTo.lastName}</span>
                  </div>
                </div>
                {lead.broughtBy && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase mb-1">Sourced By</p>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        {lead.broughtBy.firstName.charAt(0)}{lead.broughtBy.lastName.charAt(0)}
                      </div>
                      <span className="text-sm font-medium">{lead.broughtBy.firstName} {lead.broughtBy.lastName}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Created */}
            <div className="bg-white rounded-xl border p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-600 mb-1">Created</h3>
              <p className="text-sm text-gray-700">
                {new Date(lead.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              {lead.linkedCustomer ? (
                <Link href={`/customers/${lead.linkedCustomer.id}`}
                  className="w-full block text-center py-2 px-4 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm font-medium hover:bg-purple-100">
                  View Customer →
                </Link>
              ) : canEdit && ['PROSPECT', 'APPROACH', 'NEGOTIATION', 'CLOSURE'].includes(lead.status) ? (
                <button onClick={() => setShowConvertModal(true)}
                  className="w-full py-2 px-4 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-medium hover:bg-green-100">
                  Convert to Customer
                </button>
              ) : null}

              {canEdit && !isClosed && (
                <button onClick={() => setShowDeleteModal(true)}
                  className="w-full py-2 px-4 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50">
                  Request Deletion
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      {showClosureModal && lead && (
        <ClosureModal
          lead={lead}
          onClose={() => setShowClosureModal(false)}
          onSubmit={handleClosureSumbit}
          closing={closureSubmitting}
        />
      )}

      {showConvertModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold mb-3">Convert to Customer?</h2>
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="font-semibold">{lead.company}</p>
              <p className="text-sm text-gray-500">{lead.name}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowConvertModal(false)} disabled={converting}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
              <button onClick={handleConvertToCustomer} disabled={converting}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {converting ? 'Converting…' : 'Convert'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showFollowUpModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-4">Add Follow-up</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select value={followUpForm.type} onChange={e => setFollowUpForm({ ...followUpForm, type: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm">
                  {FOLLOWUP_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Date <span className="text-red-500">*</span></label>
                <input type="datetime-local" value={followUpForm.scheduledDate}
                  onChange={e => setFollowUpForm({ ...followUpForm, scheduledDate: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea value={followUpForm.notes} onChange={e => setFollowUpForm({ ...followUpForm, notes: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm h-20" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Outcome</label>
                <input type="text" value={followUpForm.outcome}
                  onChange={e => setFollowUpForm({ ...followUpForm, outcome: e.target.value })}
                  placeholder="e.g. Interested, Call back" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowFollowUpModal(false)} disabled={savingFollowUp}
                className="flex-1 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={handleAddFollowUp} disabled={savingFollowUp}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
                {savingFollowUp ? 'Saving…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold mb-3 text-red-600">Request Deletion?</h2>
            <textarea value={deleteReason} onChange={e => setDeleteReason(e.target.value)}
              placeholder="Reason…" className="w-full border rounded-lg px-3 py-2 text-sm h-20 mb-4" />
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteModal(false); setDeleteReason(''); }}
                className="flex-1 py-2 border rounded-lg text-sm">Cancel</button>
              <button onClick={handleDeleteRequest} disabled={deleting}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm disabled:opacity-50">
                {deleting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
