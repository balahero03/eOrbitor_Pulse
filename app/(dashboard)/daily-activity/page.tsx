'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Activity {
  id: string;
  userId: string;
  date: string;
  activities: string[];
  loginTime: string;
  logoutTime: string;
  notes: string;
  isEditable: boolean;
  user: { id: string; firstName: string; lastName: string };
}

export default function DailyActivityPage() {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [activities, setActivities] = useState<string[]>([]);
  const [newActivity, setNewActivity] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchActivity();
    checkLoginStatus();
    const timer = setInterval(() => updateTime(), 1000);
    return () => clearInterval(timer);
  }, [selectedDate]);

  const updateTime = () => {
    const now = new Date();
    setCurrentTime(now.toLocaleTimeString('en-IN'));
  };

  const checkLoginStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/time-tracking', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIsLoggedIn(data.isLoggedIn);
        if (data.loginTime) {
          setSessionStartTime(new Date(data.loginTime));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchActivity = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/daily-activity?date=${selectedDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data.data) {
        setActivity(data.data);
        setActivities(data.data.activities || []);
        setNotes(data.data.notes || '');
      } else {
        setActivity(null);
        setActivities([]);
        setNotes('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/time-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'LOGIN' }),
      });

      if (res.ok) {
        setIsLoggedIn(true);
        setSessionStartTime(new Date());
        alert('Logged in successfully');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to log in');
    }
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/time-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'LOGOUT' }),
      });

      if (res.ok) {
        setIsLoggedIn(false);
        alert('Logged out successfully');
        fetchActivity();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to log out');
    }
  };

  const handleAddActivity = () => {
    if (newActivity.trim()) {
      setActivities([...activities, newActivity.trim()]);
      setNewActivity('');
    }
  };

  const handleRemoveActivity = (index: number) => {
    setActivities(activities.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/daily-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          activities,
          notes,
          date: selectedDate,
        }),
      });

      if (res.ok) {
        alert('Activity saved successfully');
        setEditing(false);
        fetchActivity();
      } else {
        const err = await res.json();
        console.error('Save error:', err);
        alert(`Error: ${err.error || 'Failed to save'}\n${err.details || ''}`);
      }
    } catch (err) {
      console.error('Save exception:', err);
      alert(`Exception: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const isToday = new Date(selectedDate).toDateString() === new Date().toDateString();
  const isEditable = activity?.isEditable || isToday;

  if (loading) return <div className="p-6 text-center">Loading...</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Daily Activity Report</h1>
        <div className="text-right">
          <p className="text-sm text-gray-600">{currentTime}</p>
          <button
            onClick={isLoggedIn ? handleLogout : handleLogin}
            className={`mt-2 btn ${isLoggedIn ? 'btn-error' : 'btn-success'} text-sm`}
          >
            {isLoggedIn ? '🔴 Logout' : '🟢 Login'}
          </button>
        </div>
      </div>

      {isLoggedIn && sessionStartTime && (
        <div className="mb-6 card p-4 bg-green-50 border border-green-200">
          <p className="text-sm text-green-700">
            <strong>Logged in since:</strong> {sessionStartTime.toLocaleString('en-IN')}
          </p>
        </div>
      )}

      {/* Date Selector */}
      <div className="mb-6 card p-4">
        <label className="block text-sm font-medium mb-2">Select Date</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          max={new Date().toISOString().split('T')[0]}
          className="border rounded px-3 py-2"
        />
        <p className="text-xs text-gray-500 mt-2">
          {isEditable ? '✅ You can edit this day' : '🔒 This day is locked, you can only view'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activities Column */}
        <div className="lg:col-span-2">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Activities & Tasks</h2>
              {isEditable && !editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="btn btn-secondary btn-sm"
                >
                  ✏️ Edit
                </button>
              )}
            </div>

            {editing && isEditable ? (
              <div className="space-y-4 mb-6">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newActivity}
                    onChange={(e) => setNewActivity(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddActivity()}
                    placeholder="Add activity point... (e.g., Called 5 clients, Prepared proposal)"
                    className="flex-1 border rounded px-3 py-2 text-sm"
                  />
                  <button
                    onClick={handleAddActivity}
                    className="btn btn-primary btn-sm"
                  >
                    Add
                  </button>
                </div>

                <div className="space-y-2">
                  {activities.map((activity, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded border"
                    >
                      <div className="flex-1">
                        <p className="text-sm">{index + 1}. {activity}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveActivity(index)}
                        className="btn btn-ghost btn-sm text-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes (optional)..."
                  className="w-full border rounded px-3 py-2 h-20 text-sm"
                />

                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn btn-primary flex-1"
                  >
                    {saving ? 'Saving...' : 'Save Activity'}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setActivities(activity?.activities || []);
                      setNotes(activity?.notes || '');
                    }}
                    className="btn btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {activities.length === 0 ? (
                  <p className="text-gray-500 text-sm">No activities recorded for this day</p>
                ) : (
                  activities.map((activity, index) => (
                    <div key={index} className="p-3 bg-blue-50 rounded border border-blue-200">
                      <p className="text-sm"><strong>{index + 1}.</strong> {activity}</p>
                    </div>
                  ))
                )}

                {notes && (
                  <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-300">
                    <p className="text-xs font-semibold text-gray-600">Notes:</p>
                    <p className="text-sm text-gray-700 mt-1">{notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Summary Column */}
        <div className="space-y-4">
          <div className="card p-6">
            <h3 className="font-bold mb-4">Time Summary</h3>
            {activity ? (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-600">Login Time</p>
                  <p className="font-semibold">
                    {activity.loginTime ? new Date(activity.loginTime).toLocaleTimeString('en-IN') : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Logout Time</p>
                  <p className="font-semibold">
                    {activity.logoutTime ? new Date(activity.logoutTime).toLocaleTimeString('en-IN') : 'Still logged in'}
                  </p>
                </div>
                <div className="p-3 bg-blue-50 rounded">
                  <p className="text-gray-600">Total Activities</p>
                  <p className="text-2xl font-bold text-blue-600">{activities.length}</p>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No time log for this day yet</p>
            )}
          </div>

          <div className="card p-6">
            <h3 className="font-bold mb-3">Date Info</h3>
            <p className="text-sm text-gray-600">
              {new Date(selectedDate).toLocaleDateString('en-IN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>

          {!isEditable && (
            <div className="card p-4 bg-amber-50 border border-amber-200">
              <p className="text-xs text-amber-700">
                ℹ️ Activities can only be edited on the same day or the next day.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="mt-6">
        <Link href="/dashboard" className="btn btn-secondary">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
