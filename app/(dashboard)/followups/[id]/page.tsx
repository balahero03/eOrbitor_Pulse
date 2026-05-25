'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface FollowUp {
  id: string;
  type: string;
  scheduledDate: string;
  actualDate?: string;
  durationMinutes?: number;
  notes?: string;
  outcome?: string;
  nextAction?: string;
  deal: { id: string; dealName: string; customer: { id: string; companyName: string } };
  lead?: { id: string; name: string };
  createdBy: { id: string; firstName: string; lastName: string };
  createdAt: string;
}

export default function FollowUpDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [followUp, setFollowUp] = useState<FollowUp | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    type: '',
    actualDate: '',
    actualTime: '',
    durationMinutes: '',
    notes: '',
    outcome: '',
    nextAction: '',
  });

  useEffect(() => {
    fetchFollowUp();
  }, [params.id]);

  const fetchFollowUp = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/followups/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch follow-up');

      const data = await res.json();
      setFollowUp(data);
      setFormData({
        type: data.type,
        actualDate: data.actualDate ? new Date(data.actualDate).toISOString().split('T')[0] : '',
        actualTime: data.actualDate ? new Date(data.actualDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '',
        durationMinutes: data.durationMinutes?.toString() || '',
        notes: data.notes || '',
        outcome: data.outcome || '',
        nextAction: data.nextAction || '',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!followUp) return;

    setSaving(true);
    try {
      const actualDateTime = formData.actualDate && formData.actualTime
        ? new Date(`${formData.actualDate}T${formData.actualTime}`).toISOString()
        : null;

      const token = localStorage.getItem('token');
      const res = await fetch(`/api/followups/${params.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: formData.type,
          actualDate: actualDateTime,
          durationMinutes: formData.durationMinutes ? parseInt(formData.durationMinutes) : null,
          notes: formData.notes,
          outcome: formData.outcome,
          nextAction: formData.nextAction,
        }),
      });

      if (!res.ok) throw new Error('Failed to update follow-up');

      const updated = await res.json();
      setFollowUp(updated);
      setEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this follow-up?')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/followups/${params.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        router.push('/followups');
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

  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (!followUp) return <div className="p-6 text-center">Follow-up not found</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">{getTypeIcon(followUp.type)} {followUp.type} Follow-up</h1>
        <Link href="/followups" className="btn btn-secondary">Back to Follow-ups</Link>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-4">
          <div className="card p-6">
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="btn btn-secondary mb-4"
              >
                Update Follow-up
              </button>
            )}

            {editing ? (
              <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full"
                  >
                    <option value="CALL">Call</option>
                    <option value="EMAIL">Email</option>
                    <option value="MEETING">Meeting</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="SITE_VISIT">Site Visit</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Actual Date</label>
                    <input
                      type="date"
                      value={formData.actualDate}
                      onChange={(e) => setFormData({ ...formData, actualDate: e.target.value })}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Actual Time</label>
                    <input
                      type="time"
                      value={formData.actualTime}
                      onChange={(e) => setFormData({ ...formData, actualTime: e.target.value })}
                      className="w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Duration (minutes)</label>
                  <input
                    type="number"
                    value={formData.durationMinutes}
                    onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full h-20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Outcome</label>
                  <textarea
                    value={formData.outcome}
                    onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
                    placeholder="Summary of what was discussed..."
                    className="w-full h-20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Next Action</label>
                  <textarea
                    value={formData.nextAction}
                    onChange={(e) => setFormData({ ...formData, nextAction: e.target.value })}
                    placeholder="What's the next step..."
                    className="w-full h-20"
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
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Scheduled Date & Time</p>
                  <p className="text-lg font-medium">
                    {new Date(followUp.scheduledDate).toLocaleDateString()} at {new Date(followUp.scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                {followUp.actualDate && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Actual Date & Time</p>
                    <p className="text-lg font-medium text-green-600">
                      {new Date(followUp.actualDate).toLocaleDateString()} at {new Date(followUp.actualDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                )}

                {followUp.durationMinutes && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Duration</p>
                    <p className="text-lg font-medium">{followUp.durationMinutes} minutes</p>
                  </div>
                )}

                {followUp.notes && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Notes</p>
                    <p className="text-gray-700">{followUp.notes}</p>
                  </div>
                )}

                {followUp.outcome && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Outcome</p>
                    <p className="text-gray-700">{followUp.outcome}</p>
                  </div>
                )}

                {followUp.nextAction && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Next Action</p>
                    <p className="text-gray-700">{followUp.nextAction}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Deal Info */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-3">Related Deal</h3>
            <Link
              href={`/pipeline/${followUp.deal.id}`}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              {followUp.deal.dealName}
            </Link>
            <p className="text-sm text-gray-600 mt-1">{followUp.deal.customer.companyName}</p>
          </div>

          {/* Customer Link */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-3">Customer</h3>
            <Link
              href={`/customers/${followUp.deal.customer.id}`}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              {followUp.deal.customer.companyName}
            </Link>
          </div>

          {/* Meta */}
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Details</h3>
            <div className="space-y-2 text-xs text-gray-600">
              <p>
                <span className="font-medium">Created:</span>
                <br />
                {new Date(followUp.createdAt).toLocaleDateString()}
              </p>
              <p>
                <span className="font-medium">By:</span>
                <br />
                {followUp.createdBy.firstName} {followUp.createdBy.lastName}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="card p-6">
            <button
              onClick={handleDelete}
              className="btn btn-danger w-full"
            >
              Delete Follow-up
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
