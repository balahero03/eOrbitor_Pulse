'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Deal {
  id: string;
  dealName: string;
  stage: string;
  dealValue: number;
  winProbability: number;
  nextAction?: string;
  expectedCloseDate?: string;
  customer: { id: string; companyName: string };
  assignedTo: { firstName: string; lastName: string };
  activityLogs: any[];
  createdAt: string;
}

const STAGES = [
  { key: 'SUSPECT', label: 'Suspect' },
  { key: 'PROSPECT', label: 'Prospect' },
  { key: 'APPROACH', label: 'Approach' },
  { key: 'NEGOTIATION', label: 'Negotiation' },
  { key: 'CLOSURE', label: 'Closure' },
  { key: 'ONGOING', label: 'Ongoing' },
];

export default function DealDetailPage() {
  const router = useRouter();
  const params = useParams() as { id: string };
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    dealName: '',
    winProbability: 50,
    nextAction: '',
    expectedCloseDate: '',
  });

  useEffect(() => {
    fetchDeal();
  }, [params.id]);

  const fetchDeal = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/deals/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch deal');

      const data = await res.json();
      setDeal(data);
      setEditData({
        dealName: data.dealName,
        winProbability: data.winProbability,
        nextAction: data.nextAction || '',
        expectedCloseDate: data.expectedCloseDate?.split('T')[0] || '',
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
      const res = await fetch(`/api/deals/${params.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dealName: editData.dealName,
          winProbability: editData.winProbability,
          nextAction: editData.nextAction,
          expectedCloseDate: editData.expectedCloseDate || undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed to update deal');

      const updated = await res.json();
      setDeal(updated);
      setEditing(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStageChange = async (newStage: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/deals/${params.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ stage: newStage }),
      });

      if (!res.ok) throw new Error('Failed to update stage');

      const updated = await res.json();
      setDeal(prev => prev ? { ...prev, stage: updated.stage } : prev);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure?')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/deals/${params.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        router.push('/pipeline');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getProbabilityColor = (prob: number) => {
    if (prob >= 75) return 'bg-green-100 text-green-800';
    if (prob >= 50) return 'bg-yellow-100 text-yellow-800';
    if (prob >= 25) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (!deal) return <div className="p-6 text-center">Deal not found</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">{deal.dealName}</h1>
        <Link href="/pipeline" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Back to Pipeline</Link>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="col-span-2 space-y-4">
          {/* Deal Details */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Deal Details</h2>
              <button
                onClick={() => setEditing(!editing)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                {editing ? 'Cancel' : 'Edit'}
              </button>
            </div>

            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Deal Name</label>
                  <input
                    type="text"
                    value={editData.dealName}
                    onChange={(e) => setEditData({ ...editData, dealName: e.target.value })}
                    className="w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Win Probability %</label>
                    <input
                      type="number"
                      value={editData.winProbability}
                      onChange={(e) => setEditData({ ...editData, winProbability: parseInt(e.target.value) })}
                      min="0"
                      max="100"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Closure Date</label>
                    <input
                      type="date"
                      value={editData.expectedCloseDate}
                      onChange={(e) => setEditData({ ...editData, expectedCloseDate: e.target.value })}
                      className="w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Next Action</label>
                  <textarea
                    value={editData.nextAction}
                    onChange={(e) => setEditData({ ...editData, nextAction: e.target.value })}
                    placeholder="Next steps, action items..."
                    className="w-full h-24"
                  />
                </div>

                <button onClick={handleUpdate} className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                  Save Changes
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Customer</p>
                  <p className="text-lg font-medium">{deal.customer.companyName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Deal Value</p>
                  <p className="text-lg font-medium">{formatCurrency(deal.dealValue)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Win Probability</p>
                  <span className={`badge px-3 py-1 rounded font-medium ${getProbabilityColor(deal.winProbability)}`}>
                    {deal.winProbability}%
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Closure Date</p>
                  <p className="text-lg font-medium">
                    {deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString() : 'Not set'}
                  </p>
                </div>

                {deal.nextAction && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Next Action</p>
                    <p className="text-gray-700">{deal.nextAction}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Activity */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-bold mb-4">Recent Activity</h2>
            {deal.activityLogs.length === 0 ? (
              <p className="text-gray-600">No activity yet</p>
            ) : (
              <div className="space-y-3">
                {deal.activityLogs.map((log: any) => (
                  <div key={log.id} className="text-sm border-l-2 border-blue-200 pl-4 py-2">
                    <p className="font-medium">{log.action}</p>
                    <p className="text-xs text-gray-500">{new Date(log.createdAt).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Stage */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Pipeline Stage</h3>
            <select
              value={deal.stage}
              onChange={(e) => handleStageChange(e.target.value)}
              className="w-full"
            >
              {STAGES.map(s => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Deal Info */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Deal Info</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Created By</p>
                <p className="font-medium">{deal.assignedTo.firstName} {deal.assignedTo.lastName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Created Date</p>
                <p className="font-medium">{new Date(deal.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Expected Revenue</p>
                <p className="font-medium text-lg">
                  {formatCurrency(Math.round(deal.dealValue * (deal.winProbability / 100)))}
                </p>
              </div>
            </div>
          </div>

          {/* Customer */}
          <div className="space-y-2">
            <Link
              href={`/customers/${deal.customer.id}`}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 text-center"
            >
              View Customer
            </Link>
            <button
              onClick={handleDelete}
              className="w-full py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700"
            >
              Delete Deal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
