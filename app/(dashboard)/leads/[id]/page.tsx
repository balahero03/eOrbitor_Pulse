'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface LeadDetail {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company: string;
  source: string;
  status: string;
  leadScore: number;
  qualificationNotes?: string;
  assignedTo: { id: string; firstName: string; lastName: string };
  linkedCustomer?: any;
  followUps: Array<{ id: string; type: string; scheduledDate: string; outcome: string }>;
  createdAt: string;
}

export default function LeadDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    status: '',
    qualificationNotes: '',
  });

  useEffect(() => {
    fetchLead();
  }, [params.id]);

  const fetchLead = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/leads/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch lead');

      const data = await res.json();
      setLead(data);
      setEditData({
        status: data.status,
        qualificationNotes: data.qualificationNotes || '',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/leads/${params.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editData),
      });

      if (!res.ok) throw new Error('Failed to update lead');

      const updated = await res.json();
      setLead(updated);
      setEditing(false);
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NEW': return 'bg-blue-100 text-blue-800';
      case 'CONTACTED': return 'bg-yellow-100 text-yellow-800';
      case 'QUALIFIED': return 'bg-green-100 text-green-800';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (!lead) return <div className="p-6 text-center">Lead not found</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">{lead.name}</h1>
        <Link href="/leads" className="btn btn-secondary">Back to Leads</Link>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="col-span-2 space-y-4">
          {/* Quick Info */}
          <div className="card p-6">
            <h2 className="text-lg font-bold mb-4">Lead Information</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Email</p>
                <p className="text-lg font-medium">{lead.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Phone</p>
                <p className="text-lg font-medium">{lead.phone || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Company</p>
                <p className="text-lg font-medium">{lead.company}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Source</p>
                <p className="text-lg font-medium">{lead.source}</p>
              </div>
            </div>
          </div>

          {/* Status & Qualification */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Status & Qualification</h2>
              <button
                onClick={() => setEditing(!editing)}
                className="btn btn-secondary text-sm"
              >
                {editing ? 'Cancel' : 'Edit'}
              </button>
            </div>

            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    value={editData.status}
                    onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                    className="w-full"
                  >
                    <option value="NEW">New</option>
                    <option value="CONTACTED">Contacted</option>
                    <option value="QUALIFIED">Qualified</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Qualification Notes (BANT)</label>
                  <textarea
                    value={editData.qualificationNotes}
                    onChange={(e) => setEditData({ ...editData, qualificationNotes: e.target.value })}
                    placeholder="Budget, Authority, Need, Timeline..."
                    className="w-full h-24"
                  ></textarea>
                </div>

                <button onClick={handleUpdate} className="btn btn-primary w-full">
                  Save Changes
                </button>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Status</p>
                  <span className={`badge px-3 py-1 rounded font-medium ${getStatusColor(lead.status)}`}>
                    {lead.status}
                  </span>
                </div>

                {lead.qualificationNotes && (
                  <div className="mt-4">
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Qualification Notes</p>
                    <p className="text-gray-700">{lead.qualificationNotes}</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Recent Follow-ups */}
          <div className="card p-6">
            <h2 className="text-lg font-bold mb-4">Recent Follow-ups</h2>
            {lead.followUps.length === 0 ? (
              <p className="text-gray-600">No follow-ups yet</p>
            ) : (
              <div className="space-y-3">
                {lead.followUps.map((followUp) => (
                  <div key={followUp.id} className="flex items-start gap-4 p-3 bg-gray-50 rounded">
                    <div className="flex-1">
                      <p className="font-medium">{followUp.type}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(followUp.scheduledDate).toLocaleDateString()}
                      </p>
                    </div>
                    {followUp.outcome && (
                      <div className="text-sm text-green-700 bg-green-50 px-2 py-1 rounded">
                        {followUp.outcome}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Lead Score */}
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Lead Score</h3>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full"
                    style={{ width: `${lead.leadScore}%` }}
                  ></div>
                </div>
              </div>
              <div className="text-3xl font-bold">{lead.leadScore}</div>
            </div>
          </div>

          {/* Assigned To */}
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Assigned To</h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                {lead.assignedTo.firstName.charAt(0)}{lead.assignedTo.lastName.charAt(0)}
              </div>
              <div>
                <p className="font-medium">
                  {lead.assignedTo.firstName} {lead.assignedTo.lastName}
                </p>
              </div>
            </div>
          </div>

          {/* Created */}
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Created</h3>
            <p className="text-sm">
              {new Date(lead.createdAt).toLocaleDateString()}
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button className="btn btn-primary w-full">+ Add Follow-up</button>
            <button className="btn btn-secondary w-full">Convert to Customer</button>
          </div>
        </div>
      </div>
    </div>
  );
}
