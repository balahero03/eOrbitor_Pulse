'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireRole } from '@/lib/hooks/useRequireRole';

const ACTIVITY_MODES: Record<string, { label: string; icon: string }> = {
  MEETING:     { label: 'Meeting',       icon: '🤝' },
  CALL:        { label: 'Call',          icon: '📞' },
  SITE_VISIT:  { label: 'Site Visit',    icon: '🏢' },
  DEMO:        { label: 'Demo',          icon: '💻' },
  PROPOSAL:    { label: 'Proposal',      icon: '📄' },
  NEGOTIATION: { label: 'Negotiation',   icon: '🤜' },
  FOLLOW_UP:   { label: 'Follow-up',     icon: '🔔' },
  EMAIL:       { label: 'Email',         icon: '✉️' },
  WORK:        { label: 'Internal Work', icon: '⚙️' },
  TRAINING:    { label: 'Training',      icon: '📚' },
  OTHER:       { label: 'Other',         icon: '📌' },
};

function fmt12(t: string) {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  return `${((h % 12) || 12)}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

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

function ActivityModal({ rec, onClose }: { rec: DayRecord; onClose: () => void }) {
  const entries: ActivityEntry[] = Array.isArray(rec.activities) ? rec.activities : [];
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
              {rec.loginTime ? new Date(rec.loginTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase">Last Logout</p>
            <p className="font-bold text-red-600">
              {rec.logoutTime ? new Date(rec.logoutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : <span className="text-orange-500">Active</span>}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase">Total Hours</p>
            <p className="font-bold text-blue-700">{rec.totalHours != null ? rec.totalHours.toFixed(2) : '—'}</p>
          </div>
        </div>

        {/* Activity list */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
          {entries.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No activities recorded</p>
          ) : entries.map((a, i) => (
            <div key={a.id || i} className="border rounded-xl p-4 space-y-2 bg-gray-50">
              {/* Mode + time */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{ACTIVITY_MODES[a.mode]?.icon || '📌'}</span>
                  <span className="font-semibold text-gray-800 text-sm">{ACTIVITY_MODES[a.mode]?.label || a.mode}</span>
                </div>
                {(a.timeIn || a.timeOut) && (
                  <span className="text-xs text-gray-500 bg-white border rounded-full px-3 py-0.5">
                    {fmt12(a.timeIn)} {a.timeOut ? `→ ${fmt12(a.timeOut)}` : ''}
                  </span>
                )}
              </div>

              {/* Customer / contact */}
              {(a.custName || a.contactPerson) && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {a.custName && (
                    <div>
                      <p className="text-gray-400 font-semibold uppercase mb-0.5">Customer</p>
                      <p className="text-gray-700">{a.custName}</p>
                    </div>
                  )}
                  {a.contactPerson && (
                    <div>
                      <p className="text-gray-400 font-semibold uppercase mb-0.5">Contact Person</p>
                      <p className="text-gray-700">{a.contactPerson}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Refs */}
              {(a.quotationRef || a.orderRef) && (
                <div className="flex gap-3 text-xs">
                  {a.quotationRef && <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 rounded px-2 py-0.5">📄 {a.quotationRef}</span>}
                  {a.orderRef && <span className="bg-green-50 text-green-700 border border-green-100 rounded px-2 py-0.5">📦 {a.orderRef}</span>}
                </div>
              )}

              {/* Description */}
              {a.description && (
                <p className="text-xs text-gray-600 bg-white border rounded p-2">{a.description}</p>
              )}
            </div>
          ))}
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

export default function AttendancePage() {
  useRequireRole(['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER']);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [activityModal, setActivityModal] = useState<DayRecord | null>(null);
  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(u => {
        if (!['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER'].includes(u.role)) { router.push('/dashboard'); return; }
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
          <h1 className="text-3xl font-bold">Attendance</h1>
          <p className="text-sm text-gray-500 mt-1">Employee login/logout tracking</p>
        </div>
      </div>

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
                      <span className="text-xs text-green-600 font-normal">
                        {selectedUserId === 'all' ? `${dayRecs.length}p` : '✓'}
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
                  <p className="text-4xl mb-2">🏖️</p>
                  <p className="text-gray-500 text-sm">No login recorded</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDayRecords.map(rec => {
                    const entries: ActivityEntry[] = Array.isArray(rec.activities) ? rec.activities : [];
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
                              className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center gap-1"
                            >
                              📋 View Activities
                              <span className="bg-blue-500 text-white text-[10px] rounded-full px-1.5 py-0.5">{entries.length}</span>
                            </button>
                          )}
                        </div>

                        {/* Login / logout / hours */}
                        <div className="grid grid-cols-3 gap-2 text-center text-xs bg-gray-50 rounded-lg p-2">
                          <div>
                            <p className="text-gray-400 font-semibold uppercase">Login</p>
                            <p className="font-bold text-green-700 mt-0.5">
                              {rec.loginTime ? new Date(rec.loginTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 font-semibold uppercase">Logout</p>
                            <p className="font-bold text-red-600 mt-0.5">
                              {rec.logoutTime
                                ? new Date(rec.logoutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                                : <span className="text-orange-500">Active</span>}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 font-semibold uppercase">Hours</p>
                            <p className="font-bold text-blue-700 mt-0.5">{rec.totalHours != null ? rec.totalHours.toFixed(1) : '—'}</p>
                          </div>
                        </div>

                        {/* Activity summary pills */}
                        {entries.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {entries.map((a, i) => (
                              <span key={i} className="text-[11px] bg-white border rounded-full px-2 py-0.5 text-gray-600">
                                {ACTIVITY_MODES[a.mode]?.icon || '📌'} {a.custName || ACTIVITY_MODES[a.mode]?.label || a.mode}
                              </span>
                            ))}
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
              <p className="text-4xl mb-3">📅</p>
              <p className="text-gray-500 text-sm">Click a date to see details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
