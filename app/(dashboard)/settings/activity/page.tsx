'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ActivityLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  user: { firstName: string; lastName: string; email: string };
  createdAt: string;
  changes?: any;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [page, action, entityType]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        ...(action && { action }),
        ...(entityType && { entityType }),
      });

      const res = await fetch(`/api/activity-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch activity logs');

      const data = await res.json();
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'bg-green-100 text-green-800';
      case 'UPDATE': return 'bg-blue-100 text-blue-800';
      case 'DELETE': return 'bg-red-100 text-red-800';
      case 'VIEW': return 'bg-gray-100 text-gray-800';
      case 'EXPORT': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Activity Logs</h1>
        <Link href="/settings" className="btn btn-secondary">Back to Settings</Link>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-40"
            >
              <option value="">All Actions</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
              <option value="VIEW">View</option>
              <option value="EXPORT">Export</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Entity Type</label>
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="w-40"
            >
              <option value="">All Entities</option>
              <option value="Lead">Lead</option>
              <option value="Customer">Customer</option>
              <option value="Deal">Deal</option>
              <option value="Order">Order</option>
              <option value="Ticket">Ticket</option>
              <option value="User">User</option>
            </select>
          </div>
        </div>
      </div>

      {/* Activity Log Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-gray-600">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="p-6 text-center text-gray-600">No activity logs found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Entity Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Entity ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm">
                        <div>
                          <p className="font-medium">{log.user.firstName} {log.user.lastName}</p>
                          <p className="text-gray-500 text-xs">{log.user.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`badge px-2 py-1 rounded text-xs font-medium ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">{log.entityType}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-mono">{log.entityId.slice(0, 12)}...</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(log.createdAt).toLocaleString()}
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
    </div>
  );
}
