'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface TeamActivity {
  id: string;
  userId: string;
  date: string;
  activities: string[];
  loginTime: string;
  logoutTime: string;
  notes: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
}

export default function TeamActivityPage() {
  const [activities, setActivities] = useState<TeamActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  useEffect(() => {
    fetchTeamActivities();
  }, [selectedDate, page]);

  const fetchTeamActivities = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/daily-activity/team?date=${selectedDate}&page=${page}&limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setActivities(data.data);
        setTotal(data.pagination.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const pages = Math.ceil(total / limit);

  if (loading) return <div className="p-6 text-center">Loading...</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Team Daily Activity Report</h1>
      </div>

      {/* Date Selector */}
      <div className="mb-6 card p-4">
        <label className="block text-sm font-medium mb-2">Filter by Date</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => {
            setSelectedDate(e.target.value);
            setPage(1);
          }}
          max={new Date().toISOString().split('T')[0]}
          className="border rounded px-3 py-2"
        />
      </div>

      {/* Summary */}
      <div className="mb-6 card p-4 bg-blue-50 border border-blue-200">
        <p className="text-sm">
          <strong>{total} team members</strong> reported activities for {new Date(selectedDate).toLocaleDateString('en-IN')}
        </p>
      </div>

      {/* Activities List */}
      {activities.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          <p>No activities reported for this date</p>
        </div>
      ) : (
        <div className="space-y-6">
          {activities.map((activity) => (
            <div key={activity.id} className="card p-6 border-l-4 border-blue-500">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-lg">
                    {activity.user.firstName} {activity.user.lastName}
                  </h3>
                  <p className="text-sm text-gray-600">{activity.user.email}</p>
                </div>
                <span className="badge badge-primary">{activity.user.role}</span>
              </div>

              {/* Time Summary */}
              <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 rounded">
                <div>
                  <p className="text-xs text-gray-600">Login</p>
                  <p className="font-semibold text-sm">
                    {activity.loginTime ? new Date(activity.loginTime).toLocaleTimeString('en-IN') : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Logout</p>
                  <p className="font-semibold text-sm">
                    {activity.logoutTime ? new Date(activity.logoutTime).toLocaleTimeString('en-IN') : 'Not logged out'}
                  </p>
                </div>
              </div>

              {/* Activities */}
              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  Activities ({activity.activities.length})
                </p>
                {activity.activities.length === 0 ? (
                  <p className="text-xs text-gray-500">No activities recorded</p>
                ) : (
                  <ul className="space-y-1">
                    {activity.activities.map((act, idx) => (
                      <li key={idx} className="text-sm text-gray-700">
                        <span className="text-blue-600 font-semibold">{idx + 1}.</span> {act}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Notes */}
              {activity.notes && (
                <div className="p-3 bg-amber-50 rounded border border-amber-200">
                  <p className="text-xs font-semibold text-amber-700">Notes</p>
                  <p className="text-sm text-amber-900 mt-1">{activity.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn btn-sm btn-secondary"
          >
            ← Previous
          </button>
          <span className="text-sm">
            Page {page} of {pages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(pages, p + 1))}
            disabled={page === pages}
            className="btn btn-sm btn-secondary"
          >
            Next →
          </button>
        </div>
      )}

      <div className="mt-6">
        <Link href="/dashboard" className="btn btn-secondary">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
