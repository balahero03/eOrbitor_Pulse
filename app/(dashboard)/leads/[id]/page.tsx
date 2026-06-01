'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { SOLUTION_AREAS, OEM_LIST } from '@/lib/eorbitor-constants';

interface LeadDetail {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company: string;
  address?: string;
  source: string;
  status: string;
  leadScore: number;
  qualificationNotes?: string;
  remarks?: string;
  quoteNo?: string;
  quoteValue?: number;
  rfqDate?: string;
  followUpDate?: string;
  expectedClosureDate?: string;
  closedAt?: string;
  closureReason?: string;
  solutionAreas?: string[];
  oemNames?: string[];
  presalesIds?: string[];
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

const FOLLOWUP_TYPES = ['CALL', 'EMAIL', 'MEETING', 'WHATSAPP', 'SITE_VISIT'];

const fmt = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

// ─── Kanban Board ────────────────────────────────────────────────────────────
function SpancoKanban({
  lead,
  canEdit,
  onStageChange,
  changing,
  onClosureClick,
  onRequestReopen,
  onShowConvertModal,
}: {
  lead: LeadDetail;
  canEdit: boolean;
  onStageChange: (stage: string) => void;
  changing: boolean;
  onClosureClick: () => void;
  onRequestReopen?: () => void;
  onShowConvertModal?: () => void;
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
    if (isClosed || stageKey === lead.status || !canEdit || changing) return;
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
          const isDropTarget = !isClosed && dragOver === stage.key && stage.key !== lead.status;
          const isClickable = !isClosed && canEdit && !isActive && !changing;

          return (
            <div
              key={stage.key}
              onDragOver={e => { e.preventDefault(); !isClosed && canEdit && setDragOver(stage.key); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => !isClosed && canEdit && handleDrop(e, stage.key)}
              onClick={() => {
                if (!isClickable) return;
                // For SUSPECT → PROSPECT conversion, show modal instead of direct change
                if (lead.status === 'SUSPECT' && stage.key === 'PROSPECT') {
                  onShowConvertModal?.();
                  return;
                }
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
              <div className={`${isPast ? 'bg-green-600' : stage.headerBg} px-2 py-1.5 flex items-center justify-between transition-colors`}>
                <span className="text-white text-xs font-semibold truncate">{stage.icon} {stage.label}</span>
                {isPast && <span className="text-white text-sm font-bold flex-shrink-0">✓ Completed</span>}
                {isActive && <span className="text-white font-black text-xs flex-shrink-0">● Active</span>}
              </div>

              {/* Column body */}
              <div className={`flex-1 flex flex-col items-center p-2 gap-1 ${isPast ? 'bg-green-50' : ''}`}>
                <p className="text-[10px] text-gray-400 text-center leading-tight mt-0.5">{isPast ? '✓ ' : ''}{stage.desc}</p>

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
          {lead.status === 'SUSPECT' && (
            <button onClick={() => setShowConvertModal(true)} disabled={changing}
              className="text-xs px-3 py-1 rounded-full border bg-cyan-50 text-cyan-700 border-cyan-200 hover:opacity-80 disabled:opacity-40 font-semibold">
              📋 Convert to Prospect
            </button>
          )}
          {lead.status !== 'ON_HOLD' && lead.status !== 'SUSPECT' && (
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

      {isClosed && (
        <div className="px-4 py-2.5 bg-amber-50 border-t border-amber-100 flex items-center justify-between gap-2">
          <span className="text-xs text-amber-700 font-medium">
            🔒 This lead is closed and cannot be moved. Request admin approval to re-open.
          </span>
          {onRequestReopen && (
            <button onClick={onRequestReopen}
              className="text-xs px-3 py-1.5 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 flex-shrink-0">
              Request Re-open
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Closure Outcome Modal ────────────────────────────────────────────────────
interface ClosureFormData {
  outcome: 'WON' | 'LOST' | 'DROPPED';
  // WON fields
  quoteRef: string;
  poNumber: string;
  reasonOfWin: string;
  whatWentWell: string;
  // LOST / DROPPED fields
  reason: string;
  competitor: string;
  whatToImprove: string;
  // Attachments (max 3)
  files: (File | null)[];
}

function ClosureModal({
  lead,
  onClose,
  onSubmit,
  closing,
}: {
  lead: LeadDetail;
  onClose: () => void;
  onSubmit: (form: ClosureFormData) => void;
  closing: boolean;
}) {
  const [form, setForm] = useState<ClosureFormData>({
    outcome: 'WON',
    quoteRef: lead.quoteNo || '',
    poNumber: '',
    reasonOfWin: '',
    whatWentWell: '',
    reason: '',
    competitor: '',
    whatToImprove: '',
    files: [null, null, null],
  });

  const set = (k: keyof ClosureFormData, v: any) => setForm(f => ({ ...f, [k]: v }));

  const setFile = (idx: number, file: File | null) =>
    setForm(f => { const files = [...f.files]; files[idx] = file; return { ...f, files }; });

  const fileInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const outcomeConfig = {
    WON:     { label: 'Won',     icon: '🏆', btnColor: 'bg-green-600 hover:bg-green-700', border: 'border-green-400 bg-green-50 text-green-800' },
    LOST:    { label: 'Lost',    icon: '❌', btnColor: 'bg-red-600 hover:bg-red-700',     border: 'border-red-400 bg-red-50 text-red-800' },
    DROPPED: { label: 'Dropped', icon: '🚫', btnColor: 'bg-gray-600 hover:bg-gray-700',   border: 'border-gray-400 bg-gray-50 text-gray-700' },
  };

  const cfg = outcomeConfig[form.outcome];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Close this Deal</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              <strong>{lead.name}</strong> · {lead.company}
              {lead.quoteValue ? ` · ${fmt(lead.quoteValue)}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Outcome selector */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Outcome</p>
            <div className="grid grid-cols-3 gap-2">
              {(['WON', 'LOST', 'DROPPED'] as const).map(o => {
                const c = outcomeConfig[o];
                return (
                  <button key={o} onClick={() => set('outcome', o)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 font-medium text-sm transition-all
                      ${form.outcome === o ? c.border + ' scale-[1.03] shadow-md' : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}>
                    <span className="text-xl">{c.icon}</span>
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── WON FIELDS ── */}
          {form.outcome === 'WON' && (
            <div className="space-y-4">
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800">
                Lead moves to <strong>Orders</strong> · Manager &amp; Admin notified by email with attachments
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Quote Reference</label>
                  <input type="text" value={form.quoteRef} onChange={e => set('quoteRef', e.target.value)}
                    placeholder="e.g. QT-2026-00123"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">PO Number</label>
                  <input type="text" value={form.poNumber} onChange={e => set('poNumber', e.target.value)}
                    placeholder="Customer PO #"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  🎯 Reason of Win <span className="text-red-400">*</span>
                </label>
                <textarea value={form.reasonOfWin} onChange={e => set('reasonOfWin', e.target.value)}
                  rows={3} placeholder="Why did we win? e.g. Best price, quick delivery, strong relationship…"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">✅ What Went Well</label>
                <textarea value={form.whatWentWell} onChange={e => set('whatWentWell', e.target.value)}
                  rows={2} placeholder="Key actions, strategies, or team efforts that made the difference…"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200" />
              </div>
            </div>
          )}

          {/* ── LOST / DROPPED FIELDS ── */}
          {(form.outcome === 'LOST' || form.outcome === 'DROPPED') && (
            <div className="space-y-4">
              <div className={`p-3 rounded-lg border text-xs ${form.outcome === 'LOST' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                Lead archived in Closed Leads · Manager &amp; Admin notified by email with attachments
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  {form.outcome === 'LOST' ? '❌ Reason of Loss' : '🚫 Reason for Drop'} <span className="text-red-400">*</span>
                </label>
                <textarea value={form.reason} onChange={e => set('reason', e.target.value)}
                  rows={3} placeholder={
                    form.outcome === 'LOST'
                      ? 'e.g. Competitor offered 15% lower price, customer chose domestic vendor…'
                      : 'e.g. Customer paused procurement for 6 months due to budget freeze…'
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
              {form.outcome === 'LOST' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Competitor (if any)</label>
                  <input type="text" value={form.competitor} onChange={e => set('competitor', e.target.value)}
                    placeholder="e.g. HP India, local vendor…"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">💡 What to Improve</label>
                <textarea value={form.whatToImprove} onChange={e => set('whatToImprove', e.target.value)}
                  rows={2} placeholder="What could we do better next time? Pricing, approach, speed…"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
            </div>
          )}

          {/* ── ATTACHMENTS ── */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">
              📎 Attachments
              <span className="ml-2 text-gray-300 font-normal normal-case">Quote / Proposal / PO — up to 3 files</span>
            </p>
            <div className="space-y-2">
              {[0, 1, 2].map(idx => (
                <div key={idx} className="flex items-center gap-2">
                  <label className="text-xs text-gray-400 w-5 text-center font-medium">{idx + 1}</label>
                  <div
                    className="flex-1 flex items-center gap-2 border border-dashed rounded-lg px-3 py-2 cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors"
                    onClick={() => fileInputRefs[idx].current?.click()}
                  >
                    {form.files[idx] ? (
                      <>
                        <span className="text-blue-600 text-xs font-medium truncate flex-1">{form.files[idx]!.name}</span>
                        <span className="text-xs text-gray-400">{(form.files[idx]!.size / 1024).toFixed(0)} KB</span>
                        <button type="button" onClick={e => { e.stopPropagation(); setFile(idx, null); }}
                          className="text-gray-300 hover:text-red-400 text-lg leading-none flex-shrink-0">×</button>
                      </>
                    ) : (
                      <span className="text-xs text-gray-400">Click to attach file (PDF, DOC, XLS, IMG)</span>
                    )}
                  </div>
                  <input
                    ref={fileInputRefs[idx]}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={e => setFile(idx, e.target.files?.[0] || null)}
                  />
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose} disabled={closing}
            className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => onSubmit(form)}
            disabled={closing || (form.outcome === 'WON' ? !form.reasonOfWin.trim() : !form.reason.trim())}
            className={`flex-1 py-2.5 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors ${cfg.btnColor}`}
          >
            {closing ? 'Closing…' : `Confirm ${cfg.icon} ${cfg.label}`}
          </button>
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
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [stageChanging, setStageChanging] = useState(false);
  const [showClosureModal, setShowClosureModal] = useState(false);
  const [closureSubmitting, setClosureSubmitting] = useState(false);

  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [requestingReopen, setRequestingReopen] = useState(false);

  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpForm, setFollowUpForm] = useState({ type: 'CALL', scheduledDate: '', notes: '', outcome: '' });
  const [savingFollowUp, setSavingFollowUp] = useState(false);

  const [editData, setEditData] = useState({
    qualificationNotes: '', remarks: '',
    quoteNo: '', quoteValue: '', rfqDate: '', followUpDate: '', expectedClosureDate: '',
    address: '',
    solutionAreas: [] as string[],
    oemNames: [] as string[],
    presalesIds: [] as string[],
    employeeCount: 0,
    industry: '',
    annualRevenue: 0,
    yearEstablished: 0,
    website: '',
    keyContacts: '',
    currentInfra: '',
    budgetStatus: '',
    prospectNotes: '',
  });

  const [oemSearch, setOemSearch] = useState('');
  const [teamSearch, setTeamSearch] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setCurrentUser).catch(console.error);
    fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setUsers(Array.isArray(d.users) ? d.users : Array.isArray(d) ? d : []))
      .catch(console.error);
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
        expectedClosureDate: data.expectedClosureDate ? data.expectedClosureDate.split('T')[0] : '',
        address: data.address || '',
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

    // Prevent going back to SUSPECT from PROSPECT or later stages
    if (lead.status !== 'SUSPECT' && newStatus === 'SUSPECT') {
      alert('Cannot revert to Suspect. Once converted to Prospect, a lead cannot go back to Suspect stage.');
      return;
    }

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

  const handleClosureSumbit = async (form: ClosureFormData) => {
    setClosureSubmitting(true);
    try {
      const token = localStorage.getItem('token');

      // Convert files to base64 for JSON transport
      const attachments: { filename: string; contentType: string; dataBase64: string }[] = [];
      for (const file of form.files) {
        if (!file) continue;
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        // Safe base64 encoding (avoids stack overflow on large files)
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        attachments.push({ filename: file.name, contentType: file.type || 'application/octet-stream', dataBase64: btoa(binary) });
      }

      const res = await fetch(`/api/leads/${id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          outcome:       form.outcome,
          reason:        form.reason,
          quoteRef:      form.quoteRef,
          poNumber:      form.poNumber,
          reasonOfWin:   form.reasonOfWin,
          whatWentWell:  form.whatWentWell,
          competitor:    form.competitor,
          whatToImprove: form.whatToImprove,
          attachments,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert(e.message || `Server error ${res.status}`);
        return;
      }
      setShowClosureModal(false);
      if (form.outcome === 'WON') {
        router.push('/orders');
      } else {
        router.push('/closed-leads');
      }
    } catch (err: any) {
      alert(`Failed: ${err?.message || 'Unknown error'}`);
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

  const handleReopenRequest = async () => {
    if (!reopenReason.trim()) { alert('Please provide a reason for re-opening.'); return; }
    setRequestingReopen(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/leads/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: `RE-OPEN REQUEST: ${reopenReason}` }),
      });
      if (res.ok) {
        alert('Re-open request submitted. An admin will review and re-open the lead.');
        setShowReopenModal(false);
        setReopenReason('');
      } else {
        const e = await res.json();
        alert(e.message || 'Failed to submit request');
      }
    } catch {
      alert('An error occurred.');
    } finally {
      setRequestingReopen(false);
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

  const handleConvertToProspect = async () => {
    if (!lead) return;
    setConverting(true);
    try {
      const token = localStorage.getItem('token');
      const prospectDetails = {
        employeeCount: editData.employeeCount || 0,
        industry: editData.industry || '',
        annualRevenue: editData.annualRevenue || 0,
        yearEstablished: editData.yearEstablished || 0,
        website: editData.website || '',
        keyContacts: editData.keyContacts || '',
        currentInfra: editData.currentInfra || '',
        budgetStatus: editData.budgetStatus || '',
        prospectNotes: editData.prospectNotes || '',
        convertedAt: new Date().toISOString(),
      };

      const payload = {
        status: 'PROSPECT',
        address: editData.address || '',
        expectedClosureDate: editData.expectedClosureDate || null,
        solutionAreas: editData.solutionAreas || [],
        oemNames: editData.oemNames || [],
        presalesIds: editData.presalesIds || [],
        prospectDetails,
      };
      const res = await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json(); alert(`Failed: ${e.message}`); return; }
      setShowConvertModal(false);
      fetchLead();
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
          onRequestReopen={() => setShowReopenModal(true)}
          onShowConvertModal={() => setShowConvertModal(true)}
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
                {lead.address && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Address</p>
                    <p className="text-gray-700">{lead.address}</p>
                  </div>
                )}
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
                  <div>
                    <label className="block text-sm font-medium mb-1">Address</label>
                    <input type="text" value={editData.address}
                      onChange={e => setEditData({ ...editData, address: e.target.value })}
                      placeholder="Full address" className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Expected Closure Date</label>
                    <input type="date" value={editData.expectedClosureDate}
                      onChange={e => setEditData({ ...editData, expectedClosureDate: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm" />
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

            {/* Solution Profile */}
            {(lead.solutionAreas?.length > 0 || lead.oemNames?.length > 0) && (
              <div className="bg-white rounded-xl border p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-600 mb-3">Solution Profile</h3>
                <div className="space-y-3">
                  {lead.solutionAreas && lead.solutionAreas.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase mb-2">Solution Areas</p>
                      <div className="flex flex-wrap gap-2">
                        {lead.solutionAreas.map(areaId => {
                          const area = SOLUTION_AREAS.find(sa => sa.id === areaId);
                          return (
                            <span key={areaId} className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                              {area?.label || areaId}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {lead.oemNames && lead.oemNames.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase mb-2">OEM Names</p>
                      <div className="flex flex-wrap gap-2">
                        {lead.oemNames.map((oem, i) => (
                          <span key={i} className="inline-block bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium">
                            {oem}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Presales Members */}
            {lead.presalesUsers && lead.presalesUsers.length > 0 && (
              <div className="bg-white rounded-xl border p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-600 mb-3">Presales Members</h3>
                <div className="space-y-2">
                  {lead.presalesUsers.map((user: any) => (
                    <div key={user.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                      <div className="w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                      </div>
                      <span className="text-sm text-gray-700">{user.firstName} {user.lastName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prospect Details */}
            {lead.closureDetails && lead.status === 'PROSPECT' && (
              <div className="bg-white rounded-xl border p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-600 mb-3">Prospect Information</h3>
                <div className="space-y-2">
                  {(lead.closureDetails as any).employeeCount > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase mb-0.5">Employees</p>
                      <p className="text-sm font-medium">{(lead.closureDetails as any).employeeCount}</p>
                    </div>
                  )}
                  {(lead.closureDetails as any).industry && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase mb-0.5">Industry</p>
                      <p className="text-sm font-medium">{(lead.closureDetails as any).industry}</p>
                    </div>
                  )}
                  {(lead.closureDetails as any).annualRevenue > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase mb-0.5">Annual Revenue</p>
                      <p className="text-sm font-medium">₹{(lead.closureDetails as any).annualRevenue.toLocaleString('en-IN')}</p>
                    </div>
                  )}
                  {(lead.closureDetails as any).yearEstablished > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase mb-0.5">Year Established</p>
                      <p className="text-sm font-medium">{(lead.closureDetails as any).yearEstablished}</p>
                    </div>
                  )}
                  {(lead.closureDetails as any).website && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase mb-0.5">Website</p>
                      <p className="text-sm font-medium break-all">{(lead.closureDetails as any).website}</p>
                    </div>
                  )}
                  {(lead.closureDetails as any).budgetStatus && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase mb-0.5">Budget Status</p>
                      <p className="text-sm font-medium">{(lead.closureDetails as any).budgetStatus}</p>
                    </div>
                  )}
                  {(lead.closureDetails as any).keyContacts && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase mb-0.5">Key Contacts</p>
                      <p className="text-sm">{(lead.closureDetails as any).keyContacts}</p>
                    </div>
                  )}
                  {(lead.closureDetails as any).currentInfra && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase mb-0.5">Current Infrastructure</p>
                      <p className="text-sm">{(lead.closureDetails as any).currentInfra}</p>
                    </div>
                  )}
                  {(lead.closureDetails as any).prospectNotes && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase mb-0.5">Notes</p>
                      <p className="text-sm">{(lead.closureDetails as any).prospectNotes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

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

      {showConvertModal && lead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-6">
              <h2 className="text-lg font-bold">Convert Suspect to Prospect</h2>
              <p className="text-sm text-gray-600 mt-1">{lead.company} • {lead.name}</p>
            </div>
            <div className="p-6 space-y-6">
              <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                <p className="text-sm text-cyan-800">
                  <strong>Prospect Stage:</strong> Add detailed information about solution requirements, OEM partners involved, and presales team.
                </p>
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium mb-1">Address</label>
                <input
                  type="text"
                  defaultValue={lead.address || ''}
                  onChange={e => setEditData({ ...editData, address: e.target.value })}
                  placeholder="Full address of the customer"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              {/* Solution Areas */}
              <div>
                <label className="block text-sm font-medium mb-2">Solution Areas</label>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                  {SOLUTION_AREAS.map(area => (
                    <label key={area.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        value={area.id}
                        checked={editData.solutionAreas?.includes(area.id) || false}
                        onChange={e => {
                          const checked = e.target.checked;
                          setEditData(prev => ({
                            ...prev,
                            solutionAreas: checked
                              ? [...(prev.solutionAreas || []), area.id]
                              : (prev.solutionAreas || []).filter(s => s !== area.id),
                          }));
                        }}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700">{area.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* OEM Names */}
              <div>
                <label className="block text-sm font-medium mb-2">OEM Partners Involved</label>
                <div className="space-y-3">
                  {/* Search input */}
                  <input
                    type="text"
                    placeholder="Search OEM partners..."
                    value={oemSearch}
                    onChange={e => setOemSearch(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />

                  {/* Predefined OEM list as checkboxes */}
                  <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                    {OEM_LIST.filter(oem => oem.toLowerCase().includes(oemSearch.toLowerCase())).map(oem => (
                      <label key={oem} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editData.oemNames?.includes(oem) || false}
                          onChange={e => {
                            const checked = e.target.checked;
                            setEditData(prev => ({
                              ...prev,
                              oemNames: checked
                                ? [...(prev.oemNames || []), oem]
                                : (prev.oemNames || []).filter(o => o !== oem),
                            }));
                          }}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-700">{oem}</span>
                      </label>
                    ))}
                  </div>

                  {/* Custom OEM input */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Add Other OEM (if not in list)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        id="customOem"
                        placeholder="Enter custom OEM name..."
                        className="flex-1 border rounded-lg px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const input = document.getElementById('customOem') as HTMLInputElement;
                          const customOem = input?.value.trim();
                          if (!customOem) {
                            alert('Please enter an OEM name');
                            return;
                          }
                          if (editData.oemNames?.includes(customOem)) {
                            alert('This OEM is already added');
                            return;
                          }
                          setEditData(prev => ({
                            ...prev,
                            oemNames: [...(prev.oemNames || []), customOem],
                          }));
                          input.value = '';
                        }}
                        className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600"
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                </div>

                {/* Selected OEMs display */}
                {editData.oemNames && editData.oemNames.length > 0 && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs font-medium text-gray-600 mb-2">Selected OEMs:</p>
                    <div className="flex flex-wrap gap-2">
                      {editData.oemNames.map(oem => (
                        <div key={oem} className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                          <span>{oem}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditData(prev => ({
                                ...prev,
                                oemNames: (prev.oemNames || []).filter(o => o !== oem),
                              }));
                            }}
                            className="ml-1 hover:text-blue-900 font-bold"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Presales Members */}
              <div>
                <label className="block text-sm font-medium mb-2">Presales Team Members</label>
                <div className="space-y-3">
                  {/* Search input */}
                  <input
                    type="text"
                    placeholder="Search team members..."
                    value={teamSearch}
                    onChange={e => setTeamSearch(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />

                  {/* Team members list */}
                  <div className="space-y-1 max-h-48 overflow-y-auto border rounded-lg p-3">
                    {users.filter(u => `${u.firstName} ${u.lastName}`.toLowerCase().includes(teamSearch.toLowerCase())).map(u => (
                    <label key={u.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        value={u.id}
                        checked={editData.presalesIds?.includes(u.id) || false}
                        onChange={e => {
                          const checked = e.target.checked;
                          setEditData(prev => ({
                            ...prev,
                            presalesIds: checked
                              ? [...(prev.presalesIds || []), u.id]
                              : (prev.presalesIds || []).filter(p => p !== u.id),
                          }));
                        }}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700">{u.firstName} {u.lastName}</span>
                    </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Expected Closure Date */}
              <div>
                <label className="block text-sm font-medium mb-1">Expected Closure Date</label>
                <input
                  type="date"
                  defaultValue={lead.expectedClosureDate ? lead.expectedClosureDate.split('T')[0] : ''}
                  onChange={e => setEditData({ ...editData, expectedClosureDate: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              {/* Company Information */}
              <div className="border-t pt-6">
                <h4 className="text-sm font-semibold text-gray-800 mb-4">Company Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">No. of Employees</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 500"
                      onChange={e => setEditData({ ...editData, employeeCount: parseInt(e.target.value) || 0 })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Industry</label>
                    <input
                      type="text"
                      placeholder="e.g. IT, Manufacturing, Finance"
                      onChange={e => setEditData({ ...editData, industry: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Total Company Worth (₹)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 10000000"
                      onChange={e => setEditData({ ...editData, annualRevenue: parseFloat(e.target.value) || 0 })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Year Established</label>
                    <input
                      type="number"
                      min="1900"
                      max={new Date().getFullYear()}
                      placeholder="e.g. 2010"
                      onChange={e => setEditData({ ...editData, yearEstablished: parseInt(e.target.value) || 0 })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium mb-1">Website</label>
                  <input
                    type="url"
                    placeholder="e.g. https://company.com"
                    onChange={e => setEditData({ ...editData, website: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Other Attributes */}
              <div className="border-t pt-6">
                <h4 className="text-sm font-semibold text-gray-800 mb-4">Additional Attributes</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Key Contacts</label>
                    <textarea
                      placeholder="e.g. CEO: John Doe, CTO: Jane Smith"
                      rows={2}
                      onChange={e => setEditData({ ...editData, keyContacts: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Current IT Infrastructure</label>
                    <textarea
                      placeholder="e.g. AWS, Dell servers, Cisco networking"
                      rows={2}
                      onChange={e => setEditData({ ...editData, currentInfra: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Budget Approval Status</label>
                    <select
                      onChange={e => setEditData({ ...editData, budgetStatus: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">Select status...</option>
                      <option value="Not Allocated">Not Allocated</option>
                      <option value="Under Review">Under Review</option>
                      <option value="Approved">Approved</option>
                      <option value="In Use">In Use</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Any other notes</label>
                    <textarea
                      placeholder="Any additional information about the prospect..."
                      rows={3}
                      onChange={e => setEditData({ ...editData, prospectNotes: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => setShowConvertModal(false)}
                  disabled={converting}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConvertToProspect}
                  disabled={converting}
                  className="flex-1 py-2.5 bg-cyan-600 text-white rounded-lg text-sm font-semibold hover:bg-cyan-700 disabled:opacity-50"
                >
                  {converting ? 'Converting…' : 'Convert to Prospect'}
                </button>
              </div>
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

      {showReopenModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-amber-600 mb-1">Request Re-open</h2>
            <p className="text-sm text-gray-500 mb-4">
              This lead is closed. Submit a reason — an admin will review and re-open it if approved.
            </p>
            <textarea
              value={reopenReason}
              onChange={e => setReopenReason(e.target.value)}
              placeholder="Why should this lead be re-opened?"
              className="w-full border rounded-lg px-3 py-2 text-sm h-24 mb-4 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
            <div className="flex gap-3">
              <button onClick={() => { setShowReopenModal(false); setReopenReason(''); }}
                disabled={requestingReopen}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleReopenRequest} disabled={requestingReopen || !reopenReason.trim()}
                className="flex-1 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50">
                {requestingReopen ? 'Submitting…' : 'Submit Request'}
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
