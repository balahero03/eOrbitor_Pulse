'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  type: string;
  customer: { id: string; companyName: string };
  deal?: { id: string; dealName: string };
  assignedTo: { id: string; firstName: string; lastName: string };
  createdBy: { firstName: string; lastName: string };
  createdAt: string;
  resolvedAt?: string;
  closedAt?: string;
  resolutionNotes?: string;
  customerSatisfactionRating?: number;
}

export default function TicketDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showResolutionForm, setShowResolutionForm] = useState(false);
  const [formData, setFormData] = useState({
    status: '',
    priority: '',
    resolutionNotes: '',
    customerSatisfactionRating: '',
  });

  useEffect(() => {
    fetchTicket();
  }, [params.id]);

  const fetchTicket = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/tickets/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch ticket');

      const data = await res.json();
      setTicket(data);
      setFormData({
        status: data.status,
        priority: data.priority,
        resolutionNotes: data.resolutionNotes || '',
        customerSatisfactionRating: data.customerSatisfactionRating?.toString() || '',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!ticket) return;

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/tickets/${params.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: formData.status,
          priority: formData.priority,
          resolutionNotes: formData.resolutionNotes || null,
          customerSatisfactionRating: formData.customerSatisfactionRating
            ? parseInt(formData.customerSatisfactionRating)
            : null,
        }),
      });

      if (!res.ok) throw new Error('Failed to update ticket');

      const updated = await res.json();
      setTicket(updated);
      setEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleResolve = async () => {
    if (!ticket) return;

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/tickets/${params.id}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          resolutionNotes: formData.resolutionNotes,
          customerSatisfactionRating: formData.customerSatisfactionRating
            ? parseInt(formData.customerSatisfactionRating)
            : null,
        }),
      });

      if (!res.ok) throw new Error('Failed to resolve ticket');

      const updated = await res.json();
      setTicket(updated);
      setShowResolutionForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-red-50 text-red-700';
      case 'IN_PROGRESS': return 'bg-blue-50 text-blue-700';
      case 'RESOLVED': return 'bg-green-50 text-green-700';
      case 'CLOSED': return 'bg-gray-50 text-gray-700';
      default: return 'bg-gray-50 text-gray-700';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-100 text-red-800';
      case 'HIGH': return 'bg-orange-100 text-orange-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'LOW': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (!ticket) return <div className="p-6 text-center">Ticket not found</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">{ticket.ticketNumber}</h1>
        <Link href="/support" className="btn btn-secondary">Back to Support</Link>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-4">
          {/* Ticket Info */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold mb-2">{ticket.subject}</h2>
                <p className="text-gray-600">{ticket.description}</p>
              </div>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="btn btn-secondary"
                >
                  Edit
                </button>
              )}
            </div>

            {editing ? (
              <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4 border-t pt-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full"
                  >
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Resolution Notes</label>
                  <textarea
                    value={formData.resolutionNotes}
                    onChange={(e) => setFormData({ ...formData, resolutionNotes: e.target.value })}
                    className="w-full h-24"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn btn-primary"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3 border-t pt-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Status</p>
                  <span className={`badge px-3 py-1 rounded text-sm font-medium ${getStatusColor(ticket.status)}`}>
                    {ticket.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Priority</p>
                  <span className={`badge px-3 py-1 rounded text-sm font-medium ${getPriorityColor(ticket.priority)}`}>
                    {ticket.priority}
                  </span>
                </div>
                {ticket.resolutionNotes && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Resolution Notes</p>
                    <p className="text-gray-700">{ticket.resolutionNotes}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Resolve Ticket */}
          {ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED' && (
            <div className="card p-6 bg-blue-50 border-l-4 border-blue-500">
              {!showResolutionForm ? (
                <button
                  onClick={() => setShowResolutionForm(true)}
                  className="btn btn-primary"
                >
                  Mark as Resolved
                </button>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); handleResolve(); }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Resolution Notes</label>
                    <textarea
                      value={formData.resolutionNotes}
                      onChange={(e) => setFormData({ ...formData, resolutionNotes: e.target.value })}
                      placeholder="How was this issue resolved?"
                      rows={4}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Customer Satisfaction (1-5)</label>
                    <select
                      value={formData.customerSatisfactionRating}
                      onChange={(e) => setFormData({ ...formData, customerSatisfactionRating: e.target.value })}
                      className="w-full"
                    >
                      <option value="">No rating</option>
                      <option value="1">★ 1 - Very Unsatisfied</option>
                      <option value="2">★★ 2 - Unsatisfied</option>
                      <option value="3">★★★ 3 - Neutral</option>
                      <option value="4">★★★★ 4 - Satisfied</option>
                      <option value="5">★★★★★ 5 - Very Satisfied</option>
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="btn btn-primary"
                    >
                      {saving ? 'Resolving...' : 'Resolve Ticket'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowResolutionForm(false)}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Customer Info */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-3">Customer</h3>
            <p className="text-sm text-gray-600">Company</p>
            <p className="font-medium text-blue-600">
              <Link href={`/customers/${ticket.customer.id}`} className="hover:text-blue-800">
                {ticket.customer.companyName}
              </Link>
            </p>
          </div>

          {/* Deal Info */}
          {ticket.deal && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-3">Related Deal</h3>
              <p className="text-sm text-gray-600">Deal</p>
              <p className="font-medium text-blue-600">
                <Link href={`/pipeline/${ticket.deal.id}`} className="hover:text-blue-800">
                  {ticket.deal.dealName}
                </Link>
              </p>
            </div>
          )}

          {/* Ticket Details */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-3">Details</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-600">Type</p>
                <p className="font-medium">{ticket.type}</p>
              </div>
              <div>
                <p className="text-gray-600">Assigned To</p>
                <p className="font-medium">{ticket.assignedTo.firstName} {ticket.assignedTo.lastName}</p>
              </div>
              <div>
                <p className="text-gray-600">Created By</p>
                <p className="font-medium">{ticket.createdBy.firstName} {ticket.createdBy.lastName}</p>
              </div>
              <div>
                <p className="text-gray-600">Created At</p>
                <p className="font-medium">{new Date(ticket.createdAt).toLocaleString()}</p>
              </div>
              {ticket.resolvedAt && (
                <div>
                  <p className="text-gray-600">Resolved At</p>
                  <p className="font-medium text-green-600">{new Date(ticket.resolvedAt).toLocaleString()}</p>
                </div>
              )}
              {ticket.customerSatisfactionRating && (
                <div>
                  <p className="text-gray-600">Satisfaction</p>
                  <p className="font-medium text-yellow-600">★ {ticket.customerSatisfactionRating}/5</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
