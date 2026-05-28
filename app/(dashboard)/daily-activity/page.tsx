'use client';

import { useState, useEffect } from 'react';

interface Activity {
  id: string;
  date: string;
  activities: string[];
  notes: string;
  isEditable: boolean;
}

export default function DailyActivityPage() {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [activities, setActivities] = useState<string[]>([]);
  const [newActivity, setNewActivity] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => { fetchActivity(); }, [selectedDate]);

  const fetchActivity = async () => {
    setLoading(true);
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

  const handleAddActivity = () => {
    if (newActivity.trim()) {
      setActivities(prev => [...prev, newActivity.trim()]);
      setNewActivity('');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/daily-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ activities, notes, date: selectedDate }),
      });
      if (res.ok) {
        setEditing(false);
        fetchActivity();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error || 'Failed to save'}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const isToday = selectedDate === new Date().toISOString().slice(0, 10);
  const isEditable = activity?.isEditable ?? isToday;

  const dateLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  if (loading) return <div className="p-6 text-center text-gray-400">Loading...</div>;

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">My Daily Activity</h1>
          <p className="text-sm text-gray-500 mt-1">{dateLabel}</p>
        </div>
        <input
          type="date"
          value={selectedDate}
          max={new Date().toISOString().slice(0, 10)}
          onChange={e => { setSelectedDate(e.target.value); setEditing(false); }}
          className="border rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">
            Activities
            {activities.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-400">({activities.length})</span>
            )}
          </h2>
          {isEditable && !editing && (
            <button onClick={() => setEditing(true)} className="btn btn-secondary btn-sm">
              ✏️ Edit
            </button>
          )}
          {!isEditable && (
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">🔒 Locked</span>
          )}
        </div>

        {editing ? (
          <div className="space-y-4">
            {/* Add new */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newActivity}
                onChange={e => setNewActivity(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddActivity()}
                placeholder="Add a task or activity... (press Enter)"
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                autoFocus
              />
              <button onClick={handleAddActivity} className="btn btn-primary btn-sm">Add</button>
            </div>

            {/* List */}
            <div className="space-y-2">
              {activities.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No activities yet — add one above</p>
              )}
              {activities.map((act, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                  <span className="text-blue-500 font-bold text-sm shrink-0">{i + 1}.</span>
                  <p className="text-sm flex-1 text-gray-800">{act}</p>
                  <button
                    onClick={() => setActivities(prev => prev.filter((_, idx) => idx !== i))}
                    className="text-red-400 hover:text-red-600 text-xs shrink-0"
                  >✕</button>
                </div>
              ))}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any additional notes for the day..."
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <button onClick={handleSave} disabled={saving} className="btn btn-primary flex-1">
                {saving ? 'Saving...' : 'Save'}
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
              <div className="text-center py-8">
                <p className="text-3xl mb-2">📋</p>
                <p className="text-gray-500 text-sm">
                  {isToday ? 'No activities recorded today yet — click Edit to add' : 'No activities recorded for this day'}
                </p>
              </div>
            ) : (
              activities.map((act, i) => (
                <div key={i} className="flex gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <span className="text-blue-500 font-bold text-sm shrink-0">{i + 1}.</span>
                  <p className="text-sm text-gray-800">{act}</p>
                </div>
              ))
            )}

            {notes && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs font-semibold text-amber-700 uppercase mb-1">Notes</p>
                <p className="text-sm text-amber-900">{notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
