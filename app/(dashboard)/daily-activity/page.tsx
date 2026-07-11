'use client';

import { useState, useEffect } from 'react';
import TimeField from '@/components/TimeField';
import { ActivityIcon, ActivityChip, LockIcon, ClipboardIcon, PendingIcon, ErrorIcon, EditIcon, QuotationIcon, OrderIcon, CheckGlyph } from '@/components/icons';

const ACTIVITY_MODES = [
  { value: 'MEETING', label: 'Meeting' },
  { value: 'CALL', label: 'Call' },
  { value: 'SITE_VISIT', label: 'Site Visit' },
  { value: 'DEMO', label: 'Demo' },
  { value: 'PROPOSAL', label: 'Proposal' },
  { value: 'NEGOTIATION', label: 'Negotiation' },
  { value: 'FOLLOW_UP', label: 'Follow-up' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'WORK', label: 'Internal Work' },
  { value: 'TRAINING', label: 'Training' },
  { value: 'OTHER', label: 'Other' },
];

interface ActivityEntry {
  id: string;
  mode: string;
  custName: string;
  contactPerson: string;
  timeIn: string;
  timeOut: string;
  quotationRef: string;
  orderRef: string;
  description: string;
}

const makeEntry = (): ActivityEntry => ({
  id: Math.random().toString(36).slice(2),
  mode: 'MEETING', custName: '', contactPerson: '',
  timeIn: '', timeOut: '', quotationRef: '', orderRef: '', description: '',
});

const modeLabel = (m: string) => ACTIVITY_MODES.find(x => x.value === m)?.label || m;

function fmt24(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Minutes between two 24-hour "HH:MM" clock times, treating the end time as
// the *next* day whenever its clock value is earlier than the start's — the
// normal case for an entry or shift that crosses midnight. This can only
// account for a single day's wrap; the live "in progress" counter further
// down uses real elapsed time instead, which has no such ceiling.
function minutesBetweenClock(startHM: string, endHM: string): number {
  const [h1, m1] = startHM.split(':').map(Number);
  const [h2, m2] = endHM.split(':').map(Number);
  const start = h1 * 60 + m1;
  const end = h2 * 60 + m2;
  return end >= start ? end - start : (24 * 60 - start) + end;
}

function fmtDuration(mins: number): string {
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

function durStr(timeIn: string, timeOut: string) {
  if (!timeIn || !timeOut) return '';
  const mins = minutesBetweenClock(timeIn, timeOut);
  return mins > 0 ? fmtDuration(mins) : '';
}

// ─── Entry Edit Form ──────────────────────────────────────────────────────────
function EntryForm({ entry, idx, onChange, onRemove }: {
  entry: ActivityEntry; idx: number;
  onChange: (e: ActivityEntry) => void; onRemove: () => void;
}) {
  const s = (k: keyof ActivityEntry, v: string) => onChange({ ...entry, [k]: v });
  const dur = durStr(entry.timeIn, entry.timeOut);
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-400">{idx + 1}</span>
          <ActivityIcon mode={entry.mode} className="w-4 h-4" />
          <span className="text-sm font-semibold text-gray-700">{modeLabel(entry.mode)}</span>
          {entry.custName && <span className="text-xs text-gray-400">· {entry.custName}</span>}
          {dur && <span className="text-[11px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{dur}</span>}
        </div>
        <button onClick={onRemove} className="text-gray-300 hover:text-red-500 text-xl leading-none">×</button>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Mode <span className="text-red-400">*</span></label>
            <select value={entry.mode} onChange={e => s('mode', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
              {ACTIVITY_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Customer Name</label>
            <input type="text" value={entry.custName} onChange={e => s('custName', e.target.value)}
              placeholder="Company / Customer"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Contact Person</label>
            <input type="text" value={entry.contactPerson} onChange={e => s('contactPerson', e.target.value)}
              placeholder="Name / designation"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Time In</label>
            <TimeField value={entry.timeIn} onChange={v => s('timeIn', v)}
              className="w-full" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Time Out</label>
            <TimeField value={entry.timeOut} onChange={v => s('timeOut', v)}
              className="w-full" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Quotation Ref</label>
            <input type="text" value={entry.quotationRef} onChange={e => s('quotationRef', e.target.value)}
              placeholder="e.g. QT-2026-001"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Order Ref</label>
            <input type="text" value={entry.orderRef} onChange={e => s('orderRef', e.target.value)}
              placeholder="e.g. ORD-2026-045"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Description / Outcome</label>
          <textarea value={entry.description} onChange={e => s('description', e.target.value)}
            rows={2} placeholder="What was discussed, decided, or accomplished…"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>
      </div>
    </div>
  );
}

// ─── Entry View Card ──────────────────────────────────────────────────────────
function EntryCard({ entry, idx }: { entry: ActivityEntry; idx: number }) {
  const dur = durStr(entry.timeIn, entry.timeOut);
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
        <span className="text-xs font-bold text-gray-300 w-4">{idx + 1}</span>
        <ActivityChip mode={entry.mode} className="w-8 h-8" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {modeLabel(entry.mode)}
            {entry.custName && <span className="text-gray-500 font-normal"> · {entry.custName}</span>}
          </p>
          {entry.contactPerson && <p className="text-xs text-gray-400">{entry.contactPerson}</p>}
        </div>
        <div className="text-right flex-shrink-0">
          {(entry.timeIn || entry.timeOut) && (
            <p className="text-xs font-medium text-gray-600">
              {fmt24(entry.timeIn)}{entry.timeOut ? ` → ${fmt24(entry.timeOut)}` : ''}
            </p>
          )}
          {dur && <p className="text-xs text-blue-600 font-semibold">{dur}</p>}
        </div>
      </div>
      {(entry.quotationRef || entry.orderRef || entry.description) && (
        <div className="px-4 py-3 space-y-1.5">
          {(entry.quotationRef || entry.orderRef) && (
            <div className="flex gap-2 flex-wrap">
              {entry.quotationRef && (
                <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-full">
                  <QuotationIcon className="w-3.5 h-3.5" color="text-purple-600" /> {entry.quotationRef}
                </span>
              )}
              {entry.orderRef && (
                <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full">
                  <OrderIcon className="w-3.5 h-3.5" color="text-green-600" /> {entry.orderRef}
                </span>
              )}
            </div>
          )}
          {entry.description && (
            <p className="text-xs text-gray-600 leading-relaxed">{entry.description}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DailyActivityPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loginTime, setLoginTime] = useState('');
  const [logoutTime, setLogoutTime] = useState('');
  // True once a first login time has been saved for the selected day — it is permanent.
  const [loginLocked, setLoginLocked] = useState(false);
  const [notes, setNotes] = useState('');
  const [isEditable, setIsEditable] = useState(true);
  const [unlockRequest, setUnlockRequest] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingWorkHours, setSavingWorkHours] = useState(false);
  const [workHoursSaved, setWorkHoursSaved] = useState(false);
  // Ticks once a minute so the "still working" counter below moves live.
  const [now, setNow] = useState(() => new Date());
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [requestingUnlock, setRequestingUnlock] = useState(false);

  useEffect(() => { fetchActivity(); }, [selectedDate]);

  const fetchActivity = async () => {
    setLoading(true);
    setEditing(false);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/daily-activity?date=${selectedDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setIsEditable(json.isEditable ?? true);
      setUnlockRequest(json.unlockRequest || null);
      if (json.data) {
        const acts: ActivityEntry[] = (Array.isArray(json.data.activities) ? json.data.activities : [])
          .map((a: any) => ({ ...makeEntry(), ...a }));
        setEntries(acts);
        setLoginTime(json.data.loginTime ? new Date(json.data.loginTime).toTimeString().slice(0, 5) : '');
        setLogoutTime(json.data.logoutTime ? new Date(json.data.logoutTime).toTimeString().slice(0, 5) : '');
        setLoginLocked(!!json.data.loginTime);
        setNotes(json.data.notes || '');
      } else {
        setEntries([]); setLoginTime(''); setLogoutTime(''); setLoginLocked(false); setNotes('');
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/daily-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          date: selectedDate, activities: entries, notes,
          loginTime: loginTime ? `${selectedDate}T${loginTime}:00` : null,
        }),
      });
      if (res.ok) { setEditing(false); fetchActivity(); }
      else { const e = await res.json(); alert(e.error || 'Failed to save'); }
    } catch { alert('An error occurred.'); }
    finally { setSaving(false); }
  };

  // Exit time is never typed in directly — it's stamped from the server's
  // own clock the instant this is clicked, so an employee can't fudge it by
  // changing their device clock. Has no "Save" button of its own: it commits
  // immediately, and the displayed value comes back from the server's
  // response rather than anything computed client-side.
  const markExit = async () => {
    setSavingWorkHours(true);
    setWorkHoursSaved(false);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/daily-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ date: selectedDate, activities: entries, notes, markExitNow: true }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to save'); }
      const json = await res.json();
      setLogoutTime(json.data.logoutTime ? new Date(json.data.logoutTime).toTimeString().slice(0, 5) : '');
      setWorkHoursSaved(true);
      setTimeout(() => setWorkHoursSaved(false), 2500);
    } catch (err) { alert(err instanceof Error ? err.message : 'An error occurred.'); }
    finally { setSavingWorkHours(false); }
  };

  const handleUnlockRequest = async () => {
    if (!unlockReason.trim()) { alert('Please provide a reason.'); return; }
    setRequestingUnlock(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/daily-activity/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ date: selectedDate, reason: unlockReason }),
      });
      const data = await res.json();
      if (res.ok) { alert('Request submitted. Admin/Support will review it.'); setShowUnlockModal(false); setUnlockReason(''); fetchActivity(); }
      else alert(data.message || 'Failed');
    } catch { alert('An error occurred.'); }
    finally { setRequestingUnlock(false); }
  };

  const dateLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const totalMins = entries.reduce((sum, e) => {
    if (!e.timeIn || !e.timeOut) return sum;
    return sum + minutesBetweenClock(e.timeIn, e.timeOut);
  }, 0);

  useEffect(() => {
    if (!loginTime || logoutTime || selectedDate !== today) return;
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, [loginTime, logoutTime, selectedDate, today]);

  const workHours = (() => {
    if (!loginTime) return null;
    if (logoutTime) {
      const mins = minutesBetweenClock(loginTime, logoutTime);
      return mins > 0 ? { label: 'Total Work', text: fmtDuration(mins), live: false } : null;
    }
    if (selectedDate !== today) return null; // past date, never logged out — nothing reliable to show
    const [lh, lm] = loginTime.split(':').map(Number);
    const loginAt = new Date(selectedDate + 'T00:00:00');
    loginAt.setHours(lh, lm, 0, 0);
    // Real elapsed time, not the clock-wraparound math above — keeps
    // counting correctly past 24h for a shift that's still open.
    const mins = Math.max(0, Math.round((now.getTime() - loginAt.getTime()) / 60000));
    return { label: 'In Progress', text: fmtDuration(mins), live: true };
  })();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Activity</h1>
          <p className="text-sm text-gray-500 mt-0.5">{dateLabel}</p>
        </div>
        <input type="date" value={selectedDate} max={today}
          onChange={e => setSelectedDate(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
      </div>

      {/* Lock banner */}
      {!isEditable && (
        <div className={`rounded-xl border p-4 flex items-center justify-between gap-3 ${unlockRequest?.status === 'PENDING' ? 'bg-amber-50 border-amber-200' :
            unlockRequest?.status === 'REJECTED' ? 'bg-red-50 border-red-200' :
              'bg-gray-50 border-gray-200'
          }`}>
          <div>
            <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
              <LockIcon className="w-4 h-4" /> This date is locked
              <span className="ml-1 text-xs font-normal text-gray-500">(free edit window: today &amp; yesterday)</span>
            </p>
            {unlockRequest?.status === 'PENDING' && <p className="text-xs text-amber-700 mt-0.5 flex items-center gap-1"><PendingIcon className="w-3.5 h-3.5" /> Unlock request pending admin/support review</p>}
            {unlockRequest?.status === 'REJECTED' && <p className="text-xs text-red-600 mt-0.5 flex items-center gap-1"><ErrorIcon className="w-3.5 h-3.5" /> Previous unlock request was rejected</p>}
            {!unlockRequest && <p className="text-xs text-gray-500 mt-0.5">Request admin/support to unlock this date</p>}
          </div>
          {(!unlockRequest || unlockRequest.status === 'REJECTED') && (
            <button onClick={() => setShowUnlockModal(true)}
              className="flex-shrink-0 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700">
              Request Unlock
            </button>
          )}
        </div>
      )}

      {/* Work hours card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Work Hours</h2>
        <div className="grid grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">First Login Time</label>
            <div className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700">
              {loginTime || '—'}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              {loginLocked ? 'Recorded automatically on first login — permanent.' : 'Not recorded yet.'}
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Exit Time</label>
            <div className="flex gap-2">
              <div className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700">
                {logoutTime || '—'}
              </div>
              {isEditable && selectedDate === today && (
                <button type="button" onClick={markExit} disabled={savingWorkHours}
                  className="px-3 py-2 text-xs font-medium border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap">
                  {savingWorkHours ? 'Marking…' : 'Mark Exit Now'}
                </button>
              )}
            </div>
            <p className="text-[11px] mt-1">
              {workHoursSaved ? (
                <span className="text-green-600 font-medium inline-flex items-center gap-1"><CheckGlyph className="w-3.5 h-3.5" /> Saved</span>
              ) : (
                <span className="text-gray-400">Captured from the server's clock the moment you click — can't be typed in.</span>
              )}
            </p>
          </div>
          <div>
            {workHours ? (
              <div className={`rounded-lg px-4 py-2 text-center border ${workHours.live ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'
                }`}>
                <p className={`text-xs font-medium flex items-center justify-center gap-1 ${workHours.live ? 'text-amber-600' : 'text-blue-500'}`}>
                  {workHours.live && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                  {workHours.label}
                </p>
                <p className={`text-xl font-bold ${workHours.live ? 'text-amber-700' : 'text-blue-700'}`}>{workHours.text}</p>
              </div>
            ) : <div className="h-12" />}
          </div>
        </div>
      </div>

      {/* Activities section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">
            Activities
            {entries.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({entries.length} {entries.length === 1 ? 'entry' : 'entries'}
                {totalMins > 0 ? ` · ${Math.floor(totalMins / 60)}h ${totalMins % 60}m` : ''})
              </span>
            )}
          </h2>
          <div className="flex gap-2">
            {isEditable && !editing && (
              <button onClick={() => setEditing(true)}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 inline-flex items-center gap-1.5">
                <EditIcon className="w-4 h-4" /> Edit
              </button>
            )}
            {isEditable && editing && (
              <button onClick={() => setEntries(p => [...p, makeEntry()])}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
                + Add Activity
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : editing ? (
          <>
            {entries.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
                <p className="text-gray-400 text-sm mb-3">No activities yet</p>
                <button onClick={() => setEntries([makeEntry()])}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
                  + Add First Activity
                </button>
              </div>
            ) : entries.map((entry, idx) => (
              <EntryForm key={entry.id} entry={entry} idx={idx}
                onChange={e => setEntries(p => p.map(x => x.id === e.id ? e : x))}
                onRemove={() => setEntries(p => p.filter(x => x.id !== entry.id))} />
            ))}

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Day Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Any additional notes for the day…"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save Activity Log'}
              </button>
              <button onClick={() => { setEditing(false); fetchActivity(); }}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </>
        ) : entries.length === 0 ? (
          <div className="text-center py-14 bg-white rounded-xl border border-gray-100">
            <ClipboardIcon className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">No activities logged</p>
            <p className="text-sm text-gray-400 mt-1">
              {isEditable ? 'Click Edit to start logging your day' : 'No records for this date'}
            </p>
          </div>
        ) : (
          <>
            {entries.map((e, idx) => <EntryCard key={e.id} entry={e} idx={idx} />)}
            {notes && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-amber-700 uppercase mb-1">Notes</p>
                <p className="text-sm text-amber-900">{notes}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Unlock Request Modal */}
      {showUnlockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-amber-600 mb-1">Request Date Unlock</h2>
            <p className="text-sm text-gray-500 mb-1"><strong>{dateLabel}</strong></p>
            <p className="text-xs text-gray-400 mb-4">Explain why you need to update this date — admin/support will review and unlock if approved.</p>
            <textarea value={unlockReason} onChange={e => setUnlockReason(e.target.value)}
              placeholder="e.g. I was travelling and missed logging that day"
              className="w-full border rounded-lg px-3 py-2 text-sm h-24 mb-4 focus:outline-none focus:ring-2 focus:ring-amber-200" />
            <div className="flex gap-3">
              <button onClick={() => { setShowUnlockModal(false); setUnlockReason(''); }} disabled={requestingUnlock}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleUnlockRequest} disabled={requestingUnlock || !unlockReason.trim()}
                className="flex-1 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50">
                {requestingUnlock ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
