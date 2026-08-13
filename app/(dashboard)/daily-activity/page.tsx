'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import TimeField from '@/components/TimeField';
import { ActivityIcon, ActivityChip, LockIcon, ClipboardIcon, PendingIcon, ErrorIcon, EditIcon, QuotationIcon, OrderIcon, CheckGlyph } from '@/components/icons';
import { useToast } from '@/components/Toast';
import PageContainer from '@/components/PageContainer';
import CustomerAutocomplete, { primaryContact } from '@/components/CustomerAutocomplete';
import { InlineLoader } from '@/components/BrandedLoader';

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
      <div className="p-3 sm:p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Mode <span className="text-red-400">*</span></label>
            <select value={entry.mode} onChange={e => s('mode', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
              {ACTIVITY_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Customer Name</label>
            {/* There is no email or mobile field on an activity entry, so the
                only thing there is to carry across from an existing customer is
                the primary contact's name. */}
            <CustomerAutocomplete
              value={entry.custName}
              onChange={v => s('custName', v)}
              onSelectCustomer={c => {
                const p = primaryContact(c);
                onChange({
                  ...entry,
                  custName: c.companyName,
                  contactPerson: entry.contactPerson || p.name || '',
                });
              }}
              placeholder="Company / Customer"
              inputClassName="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>
        </div>
        {/* Contact person takes the full width on a phone and the two time
            fields share the row below it — at a hard third each, a name and
            designation had about eight characters to work with. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="col-span-2 sm:col-span-1">
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
// ─── Main Page ────────────────────────────────────────────────────────────────
function DailyActivityContent() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get('date');
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(() => {
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return dateParam;
    return today;
  });
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

  useEffect(() => {
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && dateParam !== selectedDate) {
      setSelectedDate(dateParam);
    }
  }, [dateParam]);

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
      else { const e = await res.json(); toast.error(e.error || 'Failed to save'); }
    } catch { toast.error('An error occurred.'); }
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
    } catch (err) { toast.error(err instanceof Error ? err.message : 'An error occurred.'); }
    finally { setSavingWorkHours(false); }
  };

  const handleUnlockRequest = async () => {
    if (!unlockReason.trim()) { toast.warning('Please provide a reason.'); return; }
    setRequestingUnlock(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/daily-activity/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ date: selectedDate, reason: unlockReason }),
      });
      const data = await res.json();
      if (res.ok) { toast.success('Request submitted. Admin/Support will review it.'); setShowUnlockModal(false); setUnlockReason(''); fetchActivity(); }
      else toast.error(data.message || 'Failed');
    } catch { toast.error('An error occurred.'); }
    finally { setRequestingUnlock(false); }
  };

  const dateLabel = (() => {
    const d = new Date(selectedDate + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  })();

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
    <PageContainer>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Daily Activity</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{dateLabel}</p>
        </div>
        {/* Clearing a date input reports an empty value. Falling back to today
            keeps the page on a real day — otherwise the header rendered
            "Invalid Date" while the API, whose ?date= was blank, quietly served
            today's log, and any save then failed with "Date is required". */}
        <input type="date" value={selectedDate} max={today}
          onChange={e => setSelectedDate(e.target.value || today)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 w-full sm:w-auto font-medium text-gray-700 bg-gray-50/50" />
      </div>

      {/* Lock banner */}
      {!isEditable && (
        <div className={`rounded-xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${unlockRequest?.status === 'PENDING' ? 'bg-amber-50 border-amber-200' :
          unlockRequest?.status === 'REJECTED' ? 'bg-red-50 border-red-200' :
            'bg-gray-50 border-gray-200'
          }`}>
          <div>
            <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
              <LockIcon className="w-4 h-4 flex-shrink-0" color="text-amber-600" /> This date is locked
              <span className="ml-1 text-xs font-normal text-gray-500 hidden xs:inline">(free edit window: today &amp; yesterday)</span>
            </p>
            {unlockRequest?.status === 'PENDING' && <p className="text-xs text-amber-700 mt-0.5 flex items-center gap-1"><PendingIcon className="w-3.5 h-3.5" /> Unlock request pending admin/support review</p>}
            {unlockRequest?.status === 'REJECTED' && <p className="text-xs text-red-600 mt-0.5 flex items-center gap-1"><ErrorIcon className="w-3.5 h-3.5" /> Previous unlock request was rejected</p>}
            {!unlockRequest && <p className="text-xs text-gray-500 mt-0.5">Request admin/support to unlock this date</p>}
          </div>
          {(!unlockRequest || unlockRequest.status === 'REJECTED') && (
            <button onClick={() => setShowUnlockModal(true)}
              className="w-full sm:w-auto flex-shrink-0 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 shadow-sm transition-colors">
              Request Unlock
            </button>
          )}
        </div>
      )}

      {/* Work hours — three aligned stat tiles */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3.5 sm:p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-2.5 sm:mb-3">Work Hours</h2>
        {/* Login and Exit share a row on a phone; the running total takes the
            full width below them, laid out horizontally so it costs one line
            rather than three. Stacked full-width at `p-4` with `text-2xl`
            figures and a line of helper text each, these three tiles filled
            most of the screen before the activity list appeared. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 items-stretch">
          {/* First Login */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3 sm:p-4 flex flex-col min-w-0">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider truncate">First Login</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-800 mt-1 tabular-nums leading-none">{loginTime || '—'}</p>
            <p className="text-[10px] sm:text-[11px] text-gray-400 mt-auto pt-2 leading-tight">
              {loginLocked
                ? <><span className="sm:hidden">Auto · permanent</span><span className="hidden sm:inline">Auto-recorded on first login · permanent</span></>
                : 'Not recorded yet'}
            </p>
          </div>

          {/* Exit Time */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3 sm:p-4 flex flex-col min-w-0">
            <div className="flex items-center justify-between gap-1.5">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider truncate">Exit Time</p>
              {isEditable && selectedDate === today && (
                <button type="button" onClick={markExit} disabled={savingWorkHours}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50 whitespace-nowrap flex-shrink-0">
                  {savingWorkHours ? 'Marking…' : 'Mark now'}
                </button>
              )}
            </div>
            <p className="text-xl sm:text-2xl font-bold text-gray-800 mt-1 tabular-nums leading-none">{logoutTime || '—'}</p>
            <p className="text-[10px] sm:text-[11px] mt-auto pt-2 leading-tight">
              {workHoursSaved ? (
                <span className="text-green-600 font-medium inline-flex items-center gap-1"><CheckGlyph className="w-3.5 h-3.5 flex-shrink-0" /> Saved</span>
              ) : (
                <span className="text-gray-400">
                  <span className="sm:hidden">From server clock</span>
                  <span className="hidden sm:inline">Captured from the server clock — can't be typed</span>
                </span>
              )}
            </p>
          </div>

          {/* Total / In-progress */}
          <div className={`col-span-2 sm:col-span-1 rounded-xl border p-3 sm:p-4 flex flex-col ${!workHours ? 'border-gray-200 bg-gray-50/60'
              : workHours.live ? 'border-amber-200 bg-amber-50'
                : 'border-blue-200 bg-blue-50'
            }`}>
            {/* Full width on a phone, so the label and the running figure can
                share one line instead of stacking. */}
            <div className="flex items-center justify-between gap-2 sm:block">
              <p className={`text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 min-w-0 ${!workHours ? 'text-gray-400' : workHours.live ? 'text-amber-600' : 'text-blue-500'
                }`}>
                {workHours?.live && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />}
                <span className="truncate">{workHours ? workHours.label : 'Total Work'}</span>
              </p>
              <p className={`text-xl sm:text-2xl font-bold tabular-nums leading-none flex-shrink-0 sm:mt-1 ${!workHours ? 'text-gray-400' : workHours.live ? 'text-amber-700' : 'text-blue-700'
                }`}>{workHours ? workHours.text : '—'}</p>
            </div>
            <p className={`text-[10px] sm:text-[11px] mt-1 sm:mt-auto sm:pt-2 leading-tight ${!workHours ? 'text-gray-400' : workHours.live ? 'text-amber-600/80' : 'text-blue-500/80'}`}>
              {!workHours ? 'Mark exit to log the day' : workHours.live ? 'Still working…' : 'Logged for the day'}
            </p>
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
          <div className="flex gap-2 flex-wrap">
            {isEditable && !editing && (
              <>
                {entries.length > 0 && (
                  <button onClick={() => setEditing(true)}
                    className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 inline-flex items-center gap-1.5 shadow-sm transition-colors">
                    <EditIcon className="w-4 h-4" /> Edit Log
                  </button>
                )}
                <button onClick={() => { setEditing(true); setEntries(p => [...p, makeEntry()]); }}
                  className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 inline-flex items-center gap-1.5 shadow-sm transition-colors">
                  + Add Activity
                </button>
              </>
            )}
            {isEditable && editing && (
              <button onClick={() => setEntries(p => [...p, makeEntry()])}
                className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 inline-flex items-center gap-1.5 shadow-sm transition-colors">
                + Add Another Activity
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <InlineLoader />
        ) : editing ? (
          <>
            {entries.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                <p className="text-gray-500 font-medium text-sm mb-1">No activities added yet</p>
                <p className="text-gray-400 text-xs mb-4">Click below to add your first activity for this day.</p>
                <button onClick={() => setEntries([makeEntry()])}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-sm transition-colors">
                  + Add Activity
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
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 shadow-sm transition-colors">
                {saving ? 'Saving…' : 'Save Activity Log'}
              </button>
              <button onClick={() => { setEditing(false); fetchActivity(); }}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </>
        ) : entries.length === 0 ? (
          <div className="text-center py-14 bg-white rounded-xl border border-gray-100 shadow-sm">
            <ClipboardIcon className="w-10 h-10 mx-auto mb-3" color="text-gray-300" />
            <p className="text-gray-700 font-semibold">No activities logged</p>
            <p className="text-sm text-gray-400 mt-1 mb-4">
              {isEditable ? 'Start logging your meetings, calls, and tasks for today.' : 'No records logged for this date.'}
            </p>
            {isEditable && (
              <button onClick={() => { setEditing(true); setEntries([makeEntry()]); }}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 inline-flex items-center gap-1.5 shadow-sm transition-colors">
                + Log Your First Activity
              </button>
            )}
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
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-sm p-4 sm:p-6 max-h-[92vh] overflow-y-auto animate-slide-up sm:animate-scale-in">
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
    </PageContainer>
  );
}

export default function DailyActivityPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[70vh]">
          <InlineLoader />
        </div>
      }
    >
      <DailyActivityContent />
    </Suspense>
  );
}
