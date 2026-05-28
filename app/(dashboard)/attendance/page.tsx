'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface DayRecord {
  id: string;
  userId: string;
  date: string;
  loginTime: string | null;
  logoutTime: string | null;
  totalHours: number | null;
  activities: string[];
  notes: string | null;
  user: { id: string; firstName: string; lastName: string; role: string };
}

export default function AttendancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('all');

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(u => {
        if (!['SUPER_ADMIN','ADMIN'].includes(u.role)) { router.push('/dashboard'); return; }
        loadUsers(token!);
      })
      .catch(() => router.push('/login'));
  }, []);

  const loadUsers = async (token: string) => {
    try {
      const res = await fetch('/api/users?limit=200', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      // Super admin's activity is private — exclude from dropdown
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
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Attendance</h1>
          <p className="text-sm text-gray-500 mt-1">Employee login/logout tracking</p>
        </div>
      </div>

      {/* Controls */}
      <div className="card p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Employee</label>
          <select
            value={selectedUserId}
            onChange={e => { setSelectedUserId(e.target.value); setSelectedDay(null); }}
            className="border rounded-lg px-3 py-2 text-sm min-w-48"
          >
            <option value="all">All Employees</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName} ({u.role})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Month</label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              className="btn btn-secondary btn-sm"
            >←</button>
            <span className="font-semibold text-sm px-2">{monthName}</span>
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              disabled={currentMonth >= new Date()}
              className="btn btn-secondary btn-sm disabled:opacity-40"
            >→</button>
          </div>
        </div>

        {/* Summary chips */}
        <div className="flex gap-3 ml-auto">
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
        <div className="card p-6 sticky top-20 self-start">
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
                <div className="space-y-5">
                  {selectedDayRecords.map(rec => (
                    <div key={rec.id} className="border rounded-lg p-4 space-y-3">
                      {selectedUserId === 'all' && (
                        <div className="flex items-center gap-2 pb-2 border-b">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                            {rec.user.firstName[0]}{rec.user.lastName[0]}
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{rec.user.firstName} {rec.user.lastName}</p>
                            <p className="text-xs text-gray-400">{rec.user.role}</p>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-400 font-semibold uppercase">First Login</p>
                          <p className="font-semibold text-green-700">
                            {rec.loginTime
                              ? new Date(rec.loginTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                              : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 font-semibold uppercase">Last Logout</p>
                          <p className="font-semibold text-red-600">
                            {rec.logoutTime
                              ? new Date(rec.logoutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                              : <span className="text-orange-500">Active</span>}
                          </p>
                        </div>
                      </div>

                      {rec.totalHours != null && (
                        <div className="bg-blue-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-gray-500 font-semibold uppercase">Total Hours</p>
                          <p className="text-3xl font-bold text-blue-700">{rec.totalHours.toFixed(2)}</p>
                          <p className="text-xs text-gray-400">hrs</p>
                        </div>
                      )}

                      {rec.activities && rec.activities.length > 0 && (
                        <div>
                          <p className="text-xs text-gray-500 font-semibold uppercase mb-2">Activities</p>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {rec.activities.map((a, i) => (
                              <p key={i} className="text-xs text-gray-700 bg-gray-50 rounded px-2 py-1">• {a}</p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
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
