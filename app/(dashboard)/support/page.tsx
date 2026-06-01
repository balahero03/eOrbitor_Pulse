'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  status: string;
  priority: string;
  type: string;
  customer: { companyName: string };
  assignedTo: { firstName: string; lastName: string };
  createdBy: { firstName: string; lastName: string };
  createdAt: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const STATUS_COLOR: Record<string, string> = {
  OPEN:        'bg-red-50 text-red-700 border border-red-200',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border border-blue-200',
  RESOLVED:    'bg-green-50 text-green-700 border border-green-200',
  CLOSED:      'bg-gray-100 text-gray-600',
};

const PRIORITY_COLOR: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-800 font-bold',
  HIGH:   'bg-orange-100 text-orange-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  LOW:    'bg-green-100 text-green-700',
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN:         'All Tickets',
  SALES_MANAGER: 'Team Tickets',
  SALES_EXEC:    'My Tickets',
  SUPPORT:       'Assigned to Me',
};

export default function SupportPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(u => {
        setCurrentUser(u);
        // Only ADMIN and SUPPORT can view all tickets
        if (!['SUPER_ADMIN', 'ADMIN', 'SUPPORT'].includes(u.role)) {
          setAccessDenied(true);
          setLoading(false);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!accessDenied) {
      fetchTickets();
    }
  }, [page, status, priority, accessDenied]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
        ...(status && { status }),
        ...(priority && { priority }),
      });

      const res = await fetch(`/api/tickets?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch tickets');

      const data = await res.json();
      setTickets(data.tickets || []);
      setPagination(data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openCount   = tickets.filter(t => t.status === 'OPEN').length;
  const inProgCount = tickets.filter(t => t.status === 'IN_PROGRESS').length;
  const urgentCount = tickets.filter(t => t.priority === 'URGENT').length;
  const resolvedCount = tickets.filter(t => t.status === 'RESOLVED').length;

  const scopeLabel = currentUser ? (ROLE_LABELS[currentUser.role] || 'Support Tickets') : 'Support Tickets';

  if (accessDenied) {
    return (
      <div className="p-6">
        <div className="max-w-md mx-auto mt-20">
          <div className="bg-white rounded-xl border border-red-200 shadow-lg p-8 text-center">
            <div className="text-5xl mb-4">🔒</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h1>
            <p className="text-gray-600 mb-6">
              You don't have permission to view all support tickets. Only Admins and Support staff can view the complete ticket list.
            </p>
            <p className="text-sm text-gray-500 mb-6 border-t pt-4">
              <strong>What you can do:</strong>
            </p>
            <div className="space-y-2 text-left bg-blue-50 p-4 rounded-lg mb-6">
              <p className="text-sm">✓ Create a new support ticket</p>
              <p className="text-sm">✓ Track your own ticket's status</p>
              <p className="text-sm">✓ Update your tickets with additional information</p>
            </div>
            <Link href="/support/new" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
              Create a Ticket
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Support Tickets</h1>
          <p className="text-sm text-gray-500 mt-1">{scopeLabel} · {pagination?.total ?? 0} total</p>
        </div>
        <Link href="/support/new" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">+ New Ticket</Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 bg-gradient-to-br from-blue-50 to-blue-100 border-l-4 border-blue-500">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Total</p>
          <p className="text-3xl font-bold text-blue-700 mt-1">{pagination?.total ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 bg-gradient-to-br from-red-50 to-red-100 border-l-4 border-red-500">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Open</p>
          <p className="text-3xl font-bold text-red-700 mt-1">{openCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 bg-gradient-to-br from-orange-50 to-orange-100 border-l-4 border-orange-500">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Urgent</p>
          <p className="text-3xl font-bold text-orange-700 mt-1">{urgentCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 bg-gradient-to-br from-green-50 to-green-100 border-l-4 border-green-500">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Resolved</p>
          <p className="text-3xl font-bold text-green-700 mt-1">{resolvedCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
        <form
          onSubmit={(e) => { e.preventDefault(); setPage(1); fetchTickets(); }}
          className="flex flex-wrap gap-3 items-end"
        >
          <input
            type="text"
            placeholder="Search ticket # or subject..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-48 border rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Status</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
          <select
            value={priority}
            onChange={(e) => { setPriority(e.target.value); setPage(1); }}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Priority</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">Search</button>
        </form>
      </div>

      {/* Tickets Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400">Loading...</div>
        ) : tickets.length === 0 ? (
          <div className="p-10 text-center text-gray-400">No tickets found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold text-gray-600">Ticket #</th>
                    <th className="px-5 py-3 text-left font-semibold text-gray-600">Subject</th>
                    <th className="px-5 py-3 text-left font-semibold text-gray-600">Customer</th>
                    <th className="px-5 py-3 text-left font-semibold text-gray-600">Type</th>
                    <th className="px-5 py-3 text-left font-semibold text-gray-600">Status</th>
                    <th className="px-5 py-3 text-left font-semibold text-gray-600">Priority</th>
                    <th className="px-5 py-3 text-left font-semibold text-gray-600">Assigned To</th>
                    <th className="px-5 py-3 text-left font-semibold text-gray-600">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => window.location.href = `/support/${ticket.id}`}>
                      <td className="px-5 py-4 font-medium text-blue-600">{ticket.ticketNumber}</td>
                      <td className="px-5 py-4 font-medium text-gray-900 max-w-xs truncate">{ticket.subject}</td>
                      <td className="px-5 py-4 text-gray-600">{ticket.customer.companyName}</td>
                      <td className="px-5 py-4 text-gray-500 text-xs">{ticket.type}</td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLOR[ticket.status] || 'bg-gray-100 text-gray-600'}`}>
                          {ticket.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${PRIORITY_COLOR[ticket.priority] || 'bg-gray-100 text-gray-600'}`}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-gray-600">
                        {ticket.assignedTo.firstName} {ticket.assignedTo.lastName}
                      </td>
                      <td className="px-5 py-4 text-gray-500">
                        {new Date(ticket.createdAt).toLocaleDateString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination && pagination.pages > 1 && (
              <div className="p-4 border-t flex items-center justify-between text-sm">
                <p className="text-gray-500">
                  Showing {(page - 1) * pagination.limit + 1}–{Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40">← Prev</button>
                  <span className="px-3 py-1 text-gray-600">{page} / {pagination.pages}</span>
                  <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}
                    className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40">Next →</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
