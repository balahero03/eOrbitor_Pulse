'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface FollowUp {
  id: string;
  type: string;
  scheduledDate: string;
  actualDate?: string;
  durationMinutes?: number;
  notes?: string;
  outcome?: string;
  deal: { id: string; dealName: string; customer: { companyName: string } };
  lead?: { id: string; name: string };
  createdBy: { id: string; firstName: string; lastName: string };
  createdAt: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

  useEffect(() => {
    fetchFollowUps();
  }, [page, type]);

  const fetchFollowUps = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        ...(type && { type }),
      });

      const res = await fetch(`/api/followups?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch follow-ups');

      const data = await res.json();
      setFollowUps(data.followUps);
      setPagination(data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFollowUp = async (id: string) => {
    if (!confirm('Delete this follow-up?')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/followups/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setFollowUps(followUps.filter(f => f.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'CALL': return '📞';
      case 'EMAIL': return '📧';
      case 'MEETING': return '👥';
      case 'WHATSAPP': return '💬';
      case 'SITE_VISIT': return '📍';
      default: return '📌';
    }
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getFollowUpsForDate = (date: Date) => {
    return followUps.filter(f => {
      const fDate = new Date(f.scheduledDate).toDateString();
      return fDate === date.toDateString();
    });
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(calendarMonth);
    const firstDay = getFirstDayOfMonth(calendarMonth);
    const days = [];

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="bg-gray-50 h-20"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
      const dayFollowUps = getFollowUpsForDate(date);

      days.push(
        <div key={day} className="border border-gray-200 h-20 p-2 hover:bg-gray-50">
          <div className="text-xs font-semibold text-gray-700 mb-1">{day}</div>
          <div className="space-y-1">
            {dayFollowUps.slice(0, 2).map(f => (
              <div key={f.id} className="text-xs bg-blue-50 text-blue-700 p-0.5 rounded truncate">
                {getTypeIcon(f.type)} {f.deal.customer.companyName}
              </div>
            ))}
            {dayFollowUps.length > 2 && (
              <div className="text-xs text-gray-500">+{dayFollowUps.length - 2} more</div>
            )}
          </div>
        </div>
      );
    }

    return days;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Follow-ups</h1>
        <Link href="/followups/new" className="btn btn-primary">+ Schedule Follow-up</Link>
      </div>

      {/* View Toggle */}
      <div className="card p-4 mb-6">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">View:</span>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            List
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-4 py-2 rounded ${viewMode === 'calendar' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Calendar
          </button>

          {viewMode === 'list' && (
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
              className="ml-auto"
            >
              <option value="">All Types</option>
              <option value="CALL">Call</option>
              <option value="EMAIL">Email</option>
              <option value="MEETING">Meeting</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="SITE_VISIT">Site Visit</option>
            </select>
          )}
        </div>
      </div>

      {viewMode === 'list' ? (
        // List View
        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-6 text-center text-gray-600">Loading...</div>
          ) : followUps.length === 0 ? (
            <div className="p-6 text-center text-gray-600">No follow-ups scheduled</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Deal / Customer</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Scheduled</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Completed</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Notes</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {followUps.map((followUp) => (
                      <tr key={followUp.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium">
                          {getTypeIcon(followUp.type)} {followUp.type}
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            href={`/pipeline/${followUp.deal.id}`}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            {followUp.deal.dealName}
                          </Link>
                          <div className="text-xs text-gray-600">{followUp.deal.customer.companyName}</div>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {new Date(followUp.scheduledDate).toLocaleDateString()} {new Date(followUp.scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {followUp.actualDate ? (
                            <span className="text-green-600 font-medium">
                              {new Date(followUp.actualDate).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-gray-400">Pending</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                          {followUp.notes || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex gap-2">
                            <Link
                              href={`/followups/${followUp.id}`}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Edit
                            </Link>
                            <button
                              onClick={() => handleDeleteFollowUp(followUp.id)}
                              className="text-red-600 hover:text-red-800 font-medium"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination && pagination.pages > 1 && (
                <div className="p-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Showing {(page - 1) * pagination.limit + 1} to{' '}
                    {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="btn btn-secondary disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2">{page} of {pagination.pages}</span>
                    <button
                      onClick={() => setPage(Math.min(pagination.pages, page + 1))}
                      disabled={page === pagination.pages}
                      className="btn btn-secondary disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        // Calendar View
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
                className="btn btn-secondary"
              >
                ← Prev
              </button>
              <h2 className="text-lg font-bold">
                {calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h2>
              <button
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
                className="btn btn-secondary"
              >
                Next →
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0 border border-gray-200">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="bg-gray-100 p-2 text-center font-bold text-sm border-r border-b border-gray-200">
                  {day}
                </div>
              ))}
              {renderCalendar()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
