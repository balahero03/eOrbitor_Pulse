'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireRole } from '@/lib/hooks/useRequireRole';
import TimeField from '@/components/TimeField';
import { ActivityIcon, LockIcon, WarningIcon, SuccessIcon, ClockIcon2, UserSingleIcon, QuotationIcon, ClipboardIcon, CalendarIcon, BriefcaseIcon2 } from '@/components/icons';

const ACTIVITY_MODES: Record<string, { label: string }> = {
  MEETING: { label: 'Meeting' },
  CALL: { label: 'Call' },
  SITE_VISIT: { label: 'Site Visit' },
  DEMO: { label: 'Demo' },
  PROPOSAL: { label: 'Proposal' },
  NEGOTIATION: { label: 'Negotiation' },
  FOLLOW_UP: { label: 'Follow-up' },
  EMAIL: { label: 'Email' },
  WORK: { label: 'Internal Work' },
  TRAINING: { label: 'Training' },
  OTHER: { label: 'Other' },
};

function fmt24(t: string) {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function toMin(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }

function restrictedMinutes(start: string, end: string): number {
  const startMin = toMin(start);
  const endMin = toMin(end);
  const wraps = startMin > endMin;
  return wraps ? (24 * 60 - startMin) + endMin : endMin - startMin;
}

// Spells out what the raw HH:mm window actually means in practice — native
// time inputs make an AM/PM slip (e.g. picking 6:00 PM instead of 6:00 AM)
// easy to miss, and that slip silently flips which hours are restricted.
function describeWindow(start: string, end: string): string {
  const wraps = toMin(start) > toMin(end);
  const mins = restrictedMinutes(start, end);
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  const dur = `${hours}h${remMins ? ` ${remMins}m` : ''}`;
  return wraps
    ? `Restricted from ${fmt24(start)} tonight through ${fmt24(end)} the next day — ${dur} blocked, access allowed only from ${fmt24(end)} to ${fmt24(start)}.`
    : `Restricted from ${fmt24(start)} to ${fmt24(end)} — ${dur} blocked, access allowed the rest of the day.`;
}

const WINDOW_PRESETS = [
  { label: '21:00 – 06:00', start: '21:00', end: '06:00' },
  { label: '22:00 – 08:00', start: '22:00', end: '08:00' },
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

interface DayRecord {
  id: string;
  userId: string;
  date: string;
  loginTime: string | null;
  logoutTime: string | null;
  totalHours: number | null;
  activities: ActivityEntry[];
  notes: string | null;
  user: { id: string; firstName: string; lastName: string; role: string };
}

// Some seeded/legacy DailyActivity rows store `activities` as a flat array of
// plain description strings rather than the richer object shape the real
// Daily Activity form always produces. Normalize both into one display shape
// so a legacy string entry shows its actual text instead of silently
// rendering blank (every `a.mode`/`a.custName`/etc. access on a string is
// undefined, which is why those cards used to show nothing but a pin icon).
function normalizeActivity(raw: ActivityEntry | string) {
  if (typeof raw === 'string') {
    return { mode: 'OTHER', label: 'Activity', time: undefined as string | undefined, customer: undefined as string | undefined, contact: undefined as string | undefined, refs: [] as string[], description: raw };
  }
  return {
    mode: raw.mode || 'OTHER',
    label: ACTIVITY_MODES[raw.mode]?.label || raw.mode || 'Activity',
    time: (raw.timeIn || raw.timeOut) ? `${fmt24(raw.timeIn)}${raw.timeOut ? ` → ${fmt24(raw.timeOut)}` : ''}` : undefined,
    customer: raw.custName || undefined,
    contact: raw.contactPerson || undefined,
    refs: [raw.quotationRef, raw.orderRef].filter(Boolean) as string[],
    description: raw.description || undefined,
  };
}

function ActivityModal({ rec, onClose }: { rec: DayRecord; onClose: () => void }) {
  const entries: (ActivityEntry | string)[] = Array.isArray(rec.activities) ? rec.activities : [];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <p className="font-bold text-gray-900 text-lg">{rec.user.firstName} {rec.user.lastName}</p>
            <p className="text-xs text-gray-400">
              {new Date(rec.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {' · '}<span className="text-gray-500">{rec.user.role}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
        </div>

        {/* Login/logout bar */}
        <div className="grid grid-cols-3 divide-x px-6 py-3 bg-gray-50 text-center text-sm border-b">
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase">First Login</p>
            <p className="font-bold text-green-700">
              {rec.loginTime ? new Date(rec.loginTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase">Last Logout</p>
            <p className="font-bold text-red-600">
              {rec.logoutTime ? new Date(rec.logoutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : <span className="text-orange-500">Active</span>}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase">Total Hours</p>
            <p className="font-bold text-blue-700">{rec.totalHours != null ? rec.totalHours.toFixed(2) : '—'}</p>
          </div>
        </div>

        {/* Activity list */}
        <div className="overflow-y-auto flex-1 px-8 py-6">
          {entries.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No activities recorded</p>
          ) : (
            <div className="relative border-l-2 border-blue-100 ml-4 pl-6 space-y-6 my-2">
              {entries.map((raw, i) => {
                const a = normalizeActivity(raw);
                return (
                  <div key={typeof raw === 'string' ? i : raw.id || i} className="relative group">
                    {/* Icon Node centered on the line */}
                    <div className="absolute -left-[35px] top-0.5 w-6 h-6 rounded-full bg-white border-2 border-blue-500 flex items-center justify-center shadow-sm group-hover:border-blue-600 transition-colors">
                      <ActivityIcon mode={a.mode} className="w-3.5 h-3.5" />
                    </div>

                    {/* Content Block */}
                    <div className="space-y-1.5">
                      {/* Title + Time */}
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <h4 className="font-semibold text-gray-800 text-sm">
                          {a.label}
                          {a.customer && (
                            <span className="text-gray-500 font-normal">
                              {' · '}
                              <span className="font-medium text-gray-700">{a.customer}</span>
                            </span>
                          )}
                        </h4>
                        {a.time && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-md border border-gray-200">
                            <ClockIcon2 className="w-3 h-3" /> {a.time}
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      {a.description && (
                        <p className="text-xs text-gray-600 leading-relaxed max-w-xl">
                          {a.description}
                        </p>
                      )}

                      {/* Contact / Refs */}
                      {(a.contact || a.refs.length > 0) && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {a.contact && (
                            <span className="text-[10px] font-medium text-gray-600 bg-gray-50 border border-gray-100 rounded px-2 py-0.5 flex items-center gap-1">
                              <UserSingleIcon className="w-3 h-3" /> {a.contact}
                            </span>
                          )}
                          {a.refs.map((ref, ri) => (
                            <span key={ri} className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 bg-blue-50/50 border border-blue-100 rounded px-2 py-0.5">
                              <QuotationIcon className="w-3 h-3" /> {ref}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {rec.notes && (
          <div className="px-6 py-3 border-t bg-yellow-50">
            <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Notes</p>
            <p className="text-sm text-gray-700">{rec.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

const RESTRICTABLE_ROLES = [
  { value: 'BACKEND_TEAM', label: 'Backend Team' },
  { value: 'ON_FIELD_TEAM', label: 'On Field Team' },
];

interface AccessPolicy {
  enabled: boolean;
  restrictedRoles: string[];
  windowStart: string;
  windowEnd: string;
  forceCutoff: boolean;
  currentlyRestricting?: boolean;
}

// Admin-only, collapsed-by-default section. This page is also visible to
// BACKEND_TEAM (the manager-equivalent role), who should never see this panel.
function AccessPolicySection() {
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [policy, setPolicy] = useState<AccessPolicy | null>(null);
  const [savedPolicy, setSavedPolicy] = useState<AccessPolicy | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const dirty = policy && savedPolicy && JSON.stringify(policy) !== JSON.stringify(savedPolicy);

  // Reviewing after-hours access requests now lives in the Approvals hub —
  // this section only configures the policy.
  const load = async () => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    const pRes = await fetch('/api/access-policy', { headers });
    if (pRes.ok) {
      const p = await pRes.json();
      setPolicy(p);
      setSavedPolicy(p);
    }
    setLoaded(true);
  };

  useEffect(() => { load(); }, []);

  const toggleRole = (role: string) => {
    if (!policy) return;
    setSaveMessage(null);
    setPolicy({
      ...policy,
      restrictedRoles: policy.restrictedRoles.includes(role)
        ? policy.restrictedRoles.filter(r => r !== role)
        : [...policy.restrictedRoles, role],
    });
  };

  const updatePolicy = (patch: Partial<AccessPolicy>) => {
    if (!policy) return;
    setSaveMessage(null);
    setPolicy({ ...policy, ...patch });
  };

  const applyPreset = (start: string, end: string) => updatePolicy({ windowStart: start, windowEnd: end });

  const savePolicy = async () => {
    if (!policy) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/access-policy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(policy),
      });
      const data = await res.json();
      if (res.ok) {
        setPolicy(data);
        setSavedPolicy(data);
        setSaveMessage({ type: 'success', text: 'Policy saved' });
      } else {
        setSaveMessage({ type: 'error', text: data.message || 'Failed to save policy' });
      }
    } catch {
      setSaveMessage({ type: 'error', text: 'Failed to save policy — check your connection and try again' });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!saveMessage || saveMessage.type !== 'success') return;
    const t = setTimeout(() => setSaveMessage(null), 4000);
    return () => clearTimeout(t);
  }, [saveMessage]);

  const statusStrip = policy && loaded && (
    !policy.enabled ? (
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 text-gray-500 rounded-lg px-3 py-2 text-xs">
        <span className="w-2 h-2 rounded-full bg-gray-400 shrink-0" /> Policy is off — nobody is restricted right now.
      </div>
    ) : policy.currentlyRestricting ? (
      <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs font-medium">
        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 animate-pulse" /> As of right now: restricted roles are currently <strong>blocked</strong>.
      </div>
    ) : (
      <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2 text-xs font-medium">
        <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" /> As of right now: restricted roles currently <strong>have access</strong> — we're outside the restricted window.
      </div>
    )
  );

  const durationHours = policy ? restrictedMinutes(policy.windowStart, policy.windowEnd) / 60 : 0;
  const longWindowWarning = durationHours > 16;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-gray-800 flex items-center gap-1.5"><LockIcon className="w-4 h-4" /> Access Policy</span>
          {loaded && policy?.enabled && (
            <span className="text-[10px] bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-medium">ON</span>
          )}
        </div>
        <span className="text-gray-400 text-sm">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && policy && (
        <div className="border-t px-4 py-4 space-y-6">
          {/* Policy settings */}
          <div className="space-y-3">
            {statusStrip}

            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input type="checkbox" checked={policy.enabled}
                onChange={e => updatePolicy({ enabled: e.target.checked })} />
              Restrict CRM access outside allowed hours
            </label>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Restricted roles</p>
              <div className="flex flex-wrap gap-3">
                {RESTRICTABLE_ROLES.map(r => (
                  <label key={r.value} className="flex items-center gap-1.5 text-sm text-gray-700">
                    <input type="checkbox" checked={policy.restrictedRoles.includes(r.value)}
                      onChange={() => toggleRole(r.value)} />
                    {r.label}
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Super Admin and Admin can never be restricted.</p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase">Quick presets</p>
                {WINDOW_PRESETS.map(p => (
                  <button key={p.label} type="button" onClick={() => applyPreset(p.start, p.end)}
                    className="text-xs px-2.5 py-1 border border-gray-300 rounded-full text-gray-600 hover:bg-gray-50">
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-4 items-end flex-wrap">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Restriction starts at</label>
                  <TimeField value={policy.windowStart}
                    onChange={v => updatePolicy({ windowStart: v })}
                    className="w-36" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Restriction ends at</label>
                  <TimeField value={policy.windowEnd}
                    onChange={v => updatePolicy({ windowEnd: v })}
                    className="w-36" />
                </div>
              </div>
              {policy.windowStart && policy.windowEnd && policy.windowStart !== policy.windowEnd && (
                <p className={`text-xs rounded-lg px-3 py-2 mt-2 border ${longWindowWarning
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-blue-50 border-blue-100 text-blue-700'
                  }`}>
                  {longWindowWarning && <strong className="inline-flex items-center gap-1"><WarningIcon className="w-3.5 h-3.5" /> Double-check the time window — </strong>}
                  {describeWindow(policy.windowStart, policy.windowEnd)}
                </p>
              )}
            </div>

            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={policy.forceCutoff} className="mt-0.5"
                onChange={e => updatePolicy({ forceCutoff: e.target.checked })} />
              <span>
                Also cut off already-logged-in sessions at the cutoff
                <span className="block text-[11px] text-gray-400">Off: anyone already working when the window starts can keep going. On: everyone in a restricted role is gated the moment the window starts, no matter when they logged in.</span>
              </span>
            </label>

            <div className="flex items-center gap-3">
              <button onClick={savePolicy} disabled={saving || !dirty}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : dirty ? 'Save Policy' : 'Saved'}
              </button>
              {saveMessage && (
                <span className={`text-sm font-medium ${saveMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                  {saveMessage.text}
                </span>
              )}
            </div>
          </div>

          {/* Reviewing requests moved to the Approvals hub. */}
          <div className="border-t pt-4">
            <a href="/approvals" className="inline-flex items-center gap-1.5 text-sm text-blue-600 font-medium hover:underline">
              <LockIcon className="w-4 h-4" /> Review after-hours access requests in Approvals →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AttendancePage() {
  useRequireRole(['SUPER_ADMIN', 'ADMIN', 'BACKEND_TEAM']);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [activityModal, setActivityModal] = useState<DayRecord | null>(null);
  const [currentUser, setCurrentUser] = useState<{ role: string } | null>(null);
  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(u => {
        if (!['SUPER_ADMIN', 'ADMIN', 'BACKEND_TEAM'].includes(u.role)) { router.push('/dashboard'); return; }
        setCurrentUser(u);
        loadUsers(token!);
      })
      .catch(() => router.push('/login'));
  }, []);

  const loadUsers = async (token: string) => {
    try {
      const res = await fetch('/api/users?active=true&limit=200', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      // Super admin's activity is private; for managers the API already scopes to their team
      setUsers((data.users || []).filter((u: any) => u.email !== 'lokeswaran.k@eorbitor.com'));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const params = new URLSearchParams({ date: `${year}-${String(month).padStart(2, '0')}-01` });
      if (selectedUserId !== 'all') params.set('userId', selectedUserId);

      const res = await fetch(`/api/daily-activity/team?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRecords(data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAttendance(); }, [currentMonth, selectedUserId]);

  // Calendar helpers
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  const monthName = currentMonth.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  const toDateStr = (day: number) =>
    `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const recordsForDay = (day: number) => records.filter(r => r.date === toDateStr(day));

  const selectedDayRecords = selectedDay ? records.filter(r => r.date === selectedDay) : [];

  // Summary counts for selected user
  const presentDays = new Set(records.map(r => r.date)).size;
  const totalHoursSum = records.reduce((s, r) => s + (r.totalHours || 0), 0);

  // For "all users" mode, mark a day present if ANY user has a record
  // For single user mode, mark present if that user has a record
  const isDayPresent = (day: number) => recordsForDay(day).length > 0;

  return (
    <div className="p-4 md:p-6">
      {activityModal && <ActivityModal rec={activityModal} onClose={() => setActivityModal(null)} />}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
          <p className="text-sm text-gray-500 mt-1">Employee login/logout tracking</p>
        </div>
      </div>

      {currentUser && ['SUPER_ADMIN', 'ADMIN'].includes(currentUser.role) && <AccessPolicySection />}

      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="min-w-0 flex-1 basis-40">
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Employee</label>
            <select
              value={selectedUserId}
              onChange={e => { setSelectedUserId(e.target.value); setSelectedDay(null); }}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All Employees</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} ({u.role})
                </option>
              ))}
            </select>
          </div>
          <div className="flex-shrink-0">
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Month</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
              >←</button>
              <span className="font-semibold text-sm px-2 whitespace-nowrap">{monthName}</span>
              <button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                disabled={currentMonth >= new Date()}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40"
              >→</button>
            </div>
          </div>
        </div>

        {/* Summary chips */}
        <div className="flex gap-3 mt-4">
          <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-center">
            <p className="text-xs text-gray-500 font-semibold">Present Days</p>
            <p className="text-2xl font-bold text-green-700">{presentDays}</p>
          </div>
          <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-center">
            <p className="text-xs text-gray-500 font-semibold">Total Hours</p>
            <p className="text-2xl font-bold text-blue-700">{totalHoursSum.toFixed(1)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 card p-6">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2">{d}</div>
            ))}
          </div>

          {/* Day grid */}
          {loading ? (
            <div className="py-16 text-center text-gray-400">Loading...</div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells before first day */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`e-${i}`} />
              ))}

              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const dateStr = toDateStr(day);
                const present = isDayPresent(day);
                const dayRecs = recordsForDay(day);
                const isSelected = selectedDay === dateStr;
                const isToday = dateStr === new Date().toISOString().slice(0, 10);
                const isFuture = dateStr > new Date().toISOString().slice(0, 10);

                return (
                  <button
                    key={day}
                    onClick={() => !isFuture && setSelectedDay(isSelected ? null : dateStr)}
                    disabled={isFuture}
                    className={`
                      aspect-square rounded-xl border-2 flex flex-col items-center justify-center
                      text-sm font-semibold transition-all
                      ${isFuture ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-default' :
                        isSelected ? 'border-blue-500 bg-blue-50 text-blue-800 shadow-md' :
                          present ? 'border-green-400 bg-green-50 text-green-800 hover:border-green-500 hover:shadow' :
                            'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}
                      ${isToday ? 'ring-2 ring-blue-300 ring-offset-1' : ''}
                    `}
                  >
                    <span>{day}</span>
                    {present && !isFuture && (
                      <span className="text-xs text-green-600 font-normal flex items-center justify-center">
                        {selectedUserId === 'all' ? `${dayRecs.length}p` : <SuccessIcon className="w-3.5 h-3.5" />}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="mt-4 flex gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded border-2 border-green-400 bg-green-50" />Present
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded border-2 border-gray-200 bg-white" />Absent
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded ring-2 ring-blue-300 border-2 border-gray-200" />Today
            </div>
          </div>
        </div>

        {/* Detail Panel */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sticky top-20 self-start">
          {selectedDay ? (
            <>
              <h3 className="font-bold text-gray-800 mb-4">
                {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-IN', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                })}
              </h3>

              {selectedDayRecords.length === 0 ? (
                <div className="text-center py-6">
                  <BriefcaseIcon2 className="w-9 h-9 mx-auto mb-2 text-gray-300" />
                  <p className="text-gray-500 text-sm">No login recorded</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDayRecords.map(rec => {
                    const entries: (ActivityEntry | string)[] = Array.isArray(rec.activities) ? rec.activities : [];
                    return (
                      <div key={rec.id} className="border rounded-xl p-4 space-y-3">
                        {/* User header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {rec.user.firstName[0]}{rec.user.lastName[0]}
                            </div>
                            <div>
                              <p className="font-semibold text-sm text-gray-800">{rec.user.firstName} {rec.user.lastName}</p>
                              <p className="text-xs text-gray-400">{rec.user.role}</p>
                            </div>
                          </div>
                          {entries.length > 0 && (
                            <button
                              onClick={() => setActivityModal(rec)}
                              className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full font-semibold hover:bg-blue-100 border border-blue-200 transition-colors flex items-center gap-1"
                            >
                              <ClipboardIcon className="w-3.5 h-3.5" color="text-blue-600" /> {entries.length} Activities
                            </button>
                          )}
                        </div>

                        {/* Login / logout / hours */}
                        <div className="grid grid-cols-3 gap-2 text-center text-xs bg-gray-50 rounded-lg p-2">
                          <div>
                            <p className="text-gray-400 font-semibold uppercase">Login</p>
                            <p className="font-bold text-green-700 mt-0.5">
                              {rec.loginTime ? new Date(rec.loginTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 font-semibold uppercase">Logout</p>
                            <p className="font-bold text-red-600 mt-0.5">
                              {rec.logoutTime
                                ? new Date(rec.logoutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
                                : <span className="text-orange-500">Active</span>}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 font-semibold uppercase">Hours</p>
                            <p className="font-bold text-blue-700 mt-0.5">{rec.totalHours != null ? rec.totalHours.toFixed(1) : '—'}</p>
                          </div>
                        </div>

                        {/* Activity summary — condensed to 2 rows for readability, each with its logged time; the rest lives behind "View Activities" */}
                        {entries.length > 0 && (
                          <div className="space-y-1">
                            {entries.slice(0, 2).map((raw, i) => {
                              const a = normalizeActivity(raw);
                              const snippet = a.description && a.description.length > 36 ? `${a.description.slice(0, 36)}…` : a.description;
                              const displayText = typeof raw === 'string'
                                ? snippet
                                : `${a.label}${a.customer ? ` · ${a.customer}` : ''}${a.description ? `: ${a.description}` : ''}`;
                              return (
                                <div key={i} className="flex items-center justify-between gap-2 text-xs bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 hover:bg-gray-100/70 transition-colors">
                                  <span className="flex items-center gap-1.5 text-gray-700 truncate min-w-0">
                                    <ActivityIcon mode={a.mode} className="w-3.5 h-3.5 flex-shrink-0" />
                                    <span className="truncate">{displayText || 'Activity'}</span>
                                  </span>
                                  {a.time && <span className="text-gray-400 flex-shrink-0 text-[11px] font-medium">{a.time}</span>}
                                </div>
                              );
                            })}
                            {entries.length > 2 && (
                              <button
                                onClick={() => setActivityModal(rec)}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium pl-1 pt-0.5 hover:underline flex items-center gap-0.5"
                              >
                                +{entries.length - 2} more — View all
                              </button>
                            )}
                          </div>
                        )}
                        {entries.length === 0 && (
                          <p className="text-xs text-gray-400 text-center py-1">No activities recorded</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-10">
              <CalendarIcon className="w-9 h-9 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 text-sm">Click a date to see details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
