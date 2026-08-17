'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRequireRole } from '@/lib/hooks/useRequireRole';
import { istToday } from '@/lib/istDate';
import TimeField from '@/components/TimeField';
import PageContainer from '@/components/PageContainer';
import PageHeader from '@/components/PageHeader';
import {
  LockClosedIcon,
  LockOpenIcon,
  ComputerDesktopIcon,
  BriefcaseIcon,
  ShieldCheckIcon,
  ClockIcon,
  InformationCircleIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { ActivityIcon, LockIcon, UnlockIcon, WarningIcon, SuccessIcon, ClockIcon2, UserSingleIcon, QuotationIcon, ClipboardIcon, CalendarIcon, BriefcaseIcon2, CheckGlyph, ShieldIcon, UsersMultiIcon } from '@/components/icons';
import { InlineLoader } from '@/components/BrandedLoader';
import { buttonClasses } from '@/components/Button';
import SearchableSelect from '@/components/SearchableSelect';

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

// Native checkboxes render differently in every browser and read as dated
// next to the rest of the app's controls; `accent-color` restyles the tick
// without giving up the real input's keyboard and a11y behaviour.
const CHECKBOX =
  'w-4 h-4 rounded border-gray-300 accent-blue-600 cursor-pointer ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30';

const SECTION_LABEL = 'text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2';

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
    // Bottom sheet on a phone, centred dialog from `sm` up. A centred card
    // inset by 16px on a 390pt screen wastes the margin and still puts the
    // close button at the top, which is the hardest place on the screen to
    // reach one-handed; anchoring to the bottom edge fixes both.
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col animate-slide-up sm:animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b">
          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-base sm:text-lg truncate">{rec.user.firstName} {rec.user.lastName}</p>
            <p className="text-xs text-gray-400">
              {new Date(rec.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {' · '}<span className="text-gray-500">{rec.user.role}</span>
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-700 text-2xl leading-none flex-shrink-0 -mt-1">&times;</button>
        </div>

        {/* Login/logout bar */}
        <div className="grid grid-cols-3 divide-x px-3 sm:px-6 py-3 bg-gray-50 text-center text-xs sm:text-sm border-b">
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
        <div className="overflow-y-auto flex-1 px-4 sm:px-8 py-4 sm:py-6">
          {entries.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No activities recorded</p>
          ) : (
            <div className="relative border-l-2 border-blue-100 ml-3 sm:ml-4 pl-5 sm:pl-6 space-y-5 sm:space-y-6 my-2">
              {entries.map((raw, i) => {
                const a = normalizeActivity(raw);
                return (
                  <div key={typeof raw === 'string' ? i : raw.id || i} className="relative group">
                    {/* Icon Node centered on the line */}
                    <div className="absolute -left-[32px] sm:-left-[35px] top-0.5 w-6 h-6 rounded-full bg-white border-2 border-blue-500 flex items-center justify-center shadow-sm group-hover:border-blue-600 transition-colors">
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
        setSaveMessage({ type: 'success', text: 'Policy saved successfully' });
      } else {
        setSaveMessage({ type: 'error', text: data.message || 'Failed to save policy' });
      }
    } catch {
      setSaveMessage({ type: 'error', text: 'Failed to save policy — please check connection' });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!saveMessage || saveMessage.type !== 'success') return;
    const t = setTimeout(() => setSaveMessage(null), 4000);
    return () => clearTimeout(t);
  }, [saveMessage]);

  const durationHours = policy ? Math.floor(restrictedMinutes(policy.windowStart, policy.windowEnd) / 60) : 0;
  const durationMins = policy ? restrictedMinutes(policy.windowStart, policy.windowEnd) % 60 : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-4 sm:mb-6">
      {/* Header / Trigger */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between p-3.5 sm:p-4 hover:bg-gray-50/80 transition-colors text-left focus:outline-none"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 flex-shrink-0">
            <LockClosedIcon className="w-4 h-4 text-amber-600" />
          </div>

          <div className="min-w-0 flex items-center gap-2.5">
            <span className="font-bold text-sm sm:text-base text-gray-900">Access Policy</span>
            {loaded && policy && (
              policy.enabled ? (
                policy.currentlyRestricting ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    Restricted
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Active
                  </span>
                )
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                  Disabled
                </span>
              )
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-gray-400 font-medium hidden sm:inline">
            {policy?.enabled ? `${fmt24(policy.windowStart)} – ${fmt24(policy.windowEnd)}` : 'Off'}
          </span>
          <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Body */}
      {expanded && policy && (
        <div className="border-t border-gray-100 p-4 sm:p-5 space-y-4 sm:space-y-5 bg-white">
          
          {/* Master Enable Row */}
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-gray-100">
            <div>
              <p className="text-sm font-semibold text-gray-900">Enforce Working Hours Restriction</p>
              <p className="text-xs text-gray-500 mt-0.5">Block CRM access for designated roles outside allowed hours.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={policy.enabled}
              onClick={() => updatePolicy({ enabled: !policy.enabled })}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                policy.enabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                policy.enabled ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Settings Section (Disabled state if master OFF) */}
          <div className={`space-y-4 sm:space-y-5 transition-opacity ${policy.enabled ? '' : 'opacity-40 pointer-events-none'}`}>
            
            {/* Restricted Roles */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-500 uppercase">Restricted Roles</label>
                <span className="text-[11px] text-gray-400 flex items-center gap-1">
                  <ShieldCheckIcon className="w-3.5 h-3.5 text-gray-400" /> Admins always exempt
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {RESTRICTABLE_ROLES.map(r => {
                  const isSelected = policy.restrictedRoles.includes(r.value);
                  const isBackend = r.value === 'BACKEND_TEAM';
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => toggleRole(r.value)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all ${
                        isSelected
                          ? isBackend
                            ? 'bg-blue-50 border-blue-300 text-blue-900 font-semibold'
                            : 'bg-green-50 border-green-300 text-green-900 font-semibold'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {isBackend ? (
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center ${
                            isSelected ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'
                          }`}>
                            <ComputerDesktopIcon className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center ${
                            isSelected ? 'bg-green-600 text-white' : 'bg-green-50 text-green-600'
                          }`}>
                            <BriefcaseIcon className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <span className="text-xs sm:text-sm">{r.label}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        isSelected
                          ? isBackend ? 'bg-blue-200/70 text-blue-800' : 'bg-green-200/70 text-green-800'
                          : 'bg-gray-100 text-gray-400'
                      }`}>
                        {isSelected ? 'Restricted' : 'Allowed'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Window */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-500 uppercase">Restricted Window</label>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400 hidden xs:inline">Presets:</span>
                  {WINDOW_PRESETS.map(pr => {
                    const active = policy.windowStart === pr.start && policy.windowEnd === pr.end;
                    return (
                      <button
                        key={pr.label}
                        type="button"
                        onClick={() => applyPreset(pr.start, pr.end)}
                        className={`text-xs px-2 py-0.5 rounded border font-medium transition-colors ${
                          active
                            ? 'bg-gray-800 border-gray-800 text-white'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {pr.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-600">Lock:</span>
                  <TimeField
                    value={policy.windowStart}
                    onChange={v => updatePolicy({ windowStart: v })}
                    className="w-32"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-600">Unlock:</span>
                  <TimeField
                    value={policy.windowEnd}
                    onChange={v => updatePolicy({ windowEnd: v })}
                    className="w-32"
                  />
                </div>
                <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1.5 rounded-lg border border-gray-200 font-medium">
                  {durationHours}h {durationMins > 0 ? `${durationMins}m` : ''} locked
                </span>
              </div>
            </div>

            {/* Force Cutoff Checkbox */}
            <label className="flex items-center gap-2.5 text-xs sm:text-sm text-gray-700 cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={policy.forceCutoff}
                onChange={e => updatePolicy({ forceCutoff: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
              />
              <span>Terminate active sessions immediately when restriction starts</span>
            </label>
          </div>

          {/* Footer Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3.5 border-t border-gray-100">
            <Link
              href="/approvals"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
            >
              <LockClosedIcon className="w-3.5 h-3.5 text-amber-600" />
              <span>Review after-hours access requests in Approvals →</span>
            </Link>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              {dirty || saving ? (
                <>
                  <button
                    type="button"
                    onClick={() => { setPolicy(savedPolicy); setSaveMessage(null); }}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={savePolicy}
                    disabled={saving}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition-colors shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {saving && <InlineLoader size="sm" />}
                    <span>{saving ? 'Saving…' : 'Save Policy'}</span>
                  </button>
                </>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                  <CheckGlyph className="w-3.5 h-3.5 text-green-600" /> All changes saved
                </span>
              )}
            </div>
          </div>

          {saveMessage && saveMessage.type === 'error' && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
              {saveMessage.text}
            </div>
          )}
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
  // The calendar's own cells are built from IST calendar dates (toDateStr
  // reads the displayed month directly), so "today" has to be measured the
  // same way. Comparing against the UTC date marked the wrong cell as today
  // and left the real one unclickable as "future" until 05:30 IST.
  const todayIst = istToday();
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
    <PageContainer>
      {activityModal && <ActivityModal rec={activityModal} onClose={() => setActivityModal(null)} />}
      <PageHeader title="Attendance" subtitle="Employee login/logout tracking" />

      {currentUser && ['SUPER_ADMIN', 'ADMIN'].includes(currentUser.role) && <AccessPolicySection />}

      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4">
        {/* The month stepper sits beside the employee picker on a phone rather
            than on its own labelled row — two stacked control rows plus a
            heading was most of the first screen before any data appeared. */}
        <div className="flex flex-wrap gap-3 sm:gap-4 items-end">
          <div className="min-w-0 flex-1 basis-40">
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Employee</label>
            <SearchableSelect
              value={selectedUserId === 'all' ? '' : selectedUserId}
              onChange={v => { setSelectedUserId(v || 'all'); setSelectedDay(null); }}
              emptyOptionLabel="All Employees"
              options={users.map(u => ({ value: u.id, label: `${u.firstName} ${u.lastName}`, sublabel: u.role }))}
            />
          </div>
          <div className="w-full sm:w-auto flex-shrink-0">
            <label className="hidden sm:block text-xs font-semibold text-gray-500 mb-1 uppercase">Month</label>
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <button
                aria-label="Previous month"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
              >←</button>
              <span className="font-semibold text-sm px-2 whitespace-nowrap">{monthName}</span>
              <button
                aria-label="Next month"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                disabled={currentMonth >= new Date()}
                className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40"
              >→</button>
            </div>
          </div>
        </div>

        {/* Summary chips — side by side and label-left on a phone. As stacked
            `text-2xl` blocks these two numbers cost a third of the viewport. */}
        <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-3 mt-3 sm:mt-4">
          <div className="flex sm:block items-baseline justify-between gap-2 px-3 sm:px-4 py-2 bg-green-50 border border-green-200 rounded-lg sm:text-center">
            <p className="text-xs text-gray-500 font-semibold">Present Days</p>
            <p className="text-lg sm:text-2xl font-bold text-green-700 leading-none sm:leading-normal">{presentDays}</p>
          </div>
          <div className="flex sm:block items-baseline justify-between gap-2 px-3 sm:px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg sm:text-center">
            <p className="text-xs text-gray-500 font-semibold">Total Hours</p>
            <p className="text-lg sm:text-2xl font-bold text-blue-700 leading-none sm:leading-normal">{totalHoursSum.toFixed(1)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2 card p-2.5 sm:p-6">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2">{d}</div>
            ))}
          </div>

          {/* Day grid */}
          {loading ? (
            <InlineLoader />
          ) : (
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {/* Empty cells before first day */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`e-${i}`} />
              ))}

              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const dateStr = toDateStr(day);
                const present = isDayPresent(day);
                const dayRecs = recordsForDay(day);
                const isSelected = selectedDay === dateStr;
                const isToday = dateStr === todayIst;
                const isFuture = dateStr > todayIst;

                return (
                  <button
                    key={day}
                    onClick={() => !isFuture && setSelectedDay(isSelected ? null : dateStr)}
                    disabled={isFuture}
                    className={`
                      aspect-square rounded-lg sm:rounded-xl border-2 flex flex-col items-center justify-center
                      text-xs sm:text-sm font-semibold transition-all
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
          <div className="mt-3 sm:mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500">
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

        {/* Detail Panel — `sticky` only from `lg`, where it sits in its own
            column beside the calendar. On a phone it is stacked *below* the
            calendar, and a sticky element in normal flow there just pins the
            panel over the content as you scroll past it. */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3.5 sm:p-6 lg:sticky lg:top-20 self-start">
          {selectedDay ? (
            <>
              <h3 className="font-bold text-gray-800 mb-4">
                {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-IN', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                })}
              </h3>

              {selectedDayRecords.length === 0 ? (
                <div className="text-center py-6">
                  <BriefcaseIcon2 className="w-9 h-9 mx-auto mb-2" color="text-gray-300" />
                  <p className="text-gray-500 text-sm">No login recorded</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDayRecords.map(rec => {
                    const entries: (ActivityEntry | string)[] = Array.isArray(rec.activities) ? rec.activities : [];
                    return (
                      <div key={rec.id} className="border rounded-xl p-3 sm:p-4 space-y-3">
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
              <CalendarIcon className="w-9 h-9 mx-auto mb-3" color="text-gray-300" />
              <p className="text-gray-500 text-sm">Click a date to see details</p>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
