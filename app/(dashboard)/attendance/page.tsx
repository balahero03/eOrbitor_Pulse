'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  firstLogin: string | null;
  lastLogout: string | null;
  totalHours: number;
  activities: string[];
  user: { id: string; firstName: string; lastName: string };
}

export default function AttendancePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedUserRecords, setSelectedUserRecords] = useState<AttendanceRecord[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(u => {
        if (!['ADMIN', 'SALES_MANAGER'].includes(u.role)) {
          router.push('/dashboard');
          return;
        }
        setCurrentUser(u);
        fetchUsers(token);
      })
      .catch(() => router.push('/login'));
  }, [router]);

  const fetchUsers = async (token: string) => {
    try {
      const res = await fetch('/api/users?limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setUsers(data.users || []);
      if (data.users?.length > 0) {
        setSelectedUserId(data.users[0].id);
        fetchAttendance(data.users[0].id, token);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAttendance = async (userId: string, token: string) => {
    setLoading(true);
    try {
      const year = currentMonth.getFullYear();
      const month = String(currentMonth.getMonth() + 1).padStart(2, '0');

      const res = await fetch(
        `/api/daily-activity/team?date=${year}-${month}-01&limit=31&userId=${userId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

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

  useEffect(() => {
    if (selectedUserId && currentUser) {
      const token = localStorage.getItem('token');
      if (token) fetchAttendance(selectedUserId, token);
    }
  }, [currentMonth, selectedUserId, currentUser]);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatDateString = (year: number, month: number, day: number) => {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const getAttendanceForDay = (day: number) => {
    const dateStr = formatDateString(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      day
    );
    return records.find(r => r.date === dateStr);
  };

  const handleDayClick = (day: number) => {
    const dateStr = formatDateString(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      day
    );
    setSelectedDay(dateStr);
    const dayRecords = records.filter(r => r.date === dateStr);
    setSelectedUserRecords(dayRecords);
  };

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const monthName = currentMonth.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  const selectedAttendance = getAttendanceForDay(parseInt(selectedDay?.split('-')[2] || ''));

  if (loading && !records.length) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Attendance Calendar</h1>
          <p className="text-sm text-gray-500 mt-1">Track employee login/logout and attendance</p>
        </div>
      </div>

      {/* Employee Selection */}
      <div className="mb-6 card p-4">
        <label className="block text-sm font-semibold mb-2">Select Employee</label>
        <select
          value={selectedUserId}
          onChange={e => {
            setSelectedUserId(e.target.value);
            setSelectedDay(null);
            setSelectedUserRecords([]);
          }}
          className="w-full md:w-64 border rounded-lg px-3 py-2 text-sm"
        >
          {users.map(u => (
            <option key={u.id} value={u.id}>
              {u.firstName} {u.lastName} ({u.role})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <div className="card p-6">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() =>
                  setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
                }
                className="btn btn-secondary btn-sm"
              >
                ← Previous
              </button>
              <h2 className="text-lg font-bold">{monthName}</h2>
              <button
                onClick={() =>
                  setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
                }
                className="btn btn-secondary btn-sm"
              >
                Next →
              </button>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs font-semibold text-gray-600 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day, index) => {
                if (day === null) {
                  return <div key={`empty-${index}`} className="aspect-square"></div>;
                }

                const attendance = getAttendanceForDay(day);
                const isSelected = selectedDay === formatDateString(
                  currentMonth.getFullYear(),
                  currentMonth.getMonth() + 1,
                  day
                );
                const isPresent = !!attendance?.firstLogin;

                return (
                  <button
                    key={day}
                    onClick={() => handleDayClick(day)}
                    className={`aspect-square rounded-lg border-2 flex items-center justify-center font-semibold text-sm transition ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : isPresent
                        ? 'border-green-300 bg-green-50 hover:border-green-400'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-lg">{day}</div>
                      {isPresent && <div className="text-xs text-green-600">✓</div>}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-50 border-2 border-green-300"></div>
                <span>Present</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-gray-50 border-2 border-gray-200"></div>
                <span>Absent</span>
              </div>
            </div>
          </div>
        </div>

        {/* Details Panel */}
        <div className="lg:col-span-1">
          <div className="card p-6 sticky top-20">
            <h3 className="font-bold mb-4">
              {selectedDay ? new Date(selectedDay).toLocaleDateString('en-IN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              }) : 'Select a date'}
            </h3>

            {selectedDay && selectedAttendance ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-600">First Login</p>
                  <p className="font-semibold text-sm">
                    {selectedAttendance.firstLogin
                      ? new Date(selectedAttendance.firstLogin).toLocaleTimeString('en-IN')
                      : '—'}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-600">Last Logout</p>
                  <p className="font-semibold text-sm">
                    {selectedAttendance.lastLogout
                      ? new Date(selectedAttendance.lastLogout).toLocaleTimeString('en-IN')
                      : 'Still logged in'}
                  </p>
                </div>

                <div className="p-3 bg-blue-50 rounded border border-blue-200">
                  <p className="text-xs text-gray-600">Total Hours</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {selectedAttendance.totalHours
                      ? selectedAttendance.totalHours.toFixed(2)
                      : '—'}
                  </p>
                </div>

                {selectedAttendance.activities && selectedAttendance.activities.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-600 font-semibold mb-2">Activities</p>
                    <div className="space-y-1">
                      {selectedAttendance.activities.map((activity, i) => (
                        <p key={i} className="text-xs text-gray-700 bg-gray-50 p-1.5 rounded">
                          • {activity}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No data for selected date</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <Link href="/dashboard" className="btn btn-secondary">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
