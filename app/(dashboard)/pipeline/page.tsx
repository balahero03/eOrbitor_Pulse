'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Deal {
  id: string;
  dealName: string;
  stage: string;
  dealValue: number;
  winProbability: number;
  customer: { id: string; companyName: string };
  assignedTo: { firstName: string; lastName: string };
  expectedCloseDate?: string;
  createdAt: string;
}

const STAGES = [
  { key: 'SUSPECT', label: 'Suspect', color: 'bg-blue-50 border-blue-200' },
  { key: 'PROSPECT', label: 'Prospect', color: 'bg-cyan-50 border-cyan-200' },
  { key: 'APPROACH', label: 'Approach', color: 'bg-indigo-50 border-indigo-200' },
  { key: 'NEGOTIATION', label: 'Negotiation', color: 'bg-yellow-50 border-yellow-200' },
  { key: 'CLOSURE', label: 'Closure', color: 'bg-green-50 border-green-200' },
  { key: 'ONGOING', label: 'Ongoing', color: 'bg-purple-50 border-purple-200' },
];

export default function PipelinePage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null);

  useEffect(() => {
    fetchDeals();
  }, [search]);

  const fetchDeals = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        ...(search && { search }),
      });

      const res = await fetch(`/api/deals?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch deals');

      const data = await res.json();
      setDeals(data.deals);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (deal: Deal) => {
    setDraggedDeal(deal);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (newStage: string) => {
    if (!draggedDeal || draggedDeal.stage === newStage) {
      setDraggedDeal(null);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/deals/${draggedDeal.id}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newStage }),
      });

      if (!res.ok) throw new Error('Failed to move deal');

      setDeals(deals.map(d =>
        d.id === draggedDeal.id ? { ...d, stage: newStage } : d
      ));
      setDraggedDeal(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteDeal = async (id: string) => {
    if (!confirm('Are you sure?')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/deals/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setDeals(deals.filter(d => d.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getDealsByStage = (stage: string) => deals.filter(d => d.stage === stage);

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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Sales Pipeline</h1>
        <Link href="/pipeline/new" className="btn btn-primary">+ New Deal</Link>
      </div>

      {/* Search */}
      <div className="card p-4 mb-6">
        <input
          type="text"
          placeholder="Search deals by name or company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full"
        />
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div className="p-6 text-center text-gray-600">Loading pipeline...</div>
      ) : (
        <div className="grid grid-cols-6 gap-4 pb-6">
          {STAGES.map((stage) => {
            const stageDeals = getDealsByStage(stage.key);
            const stageValue = stageDeals.reduce((sum, d) => sum + d.dealValue, 0);
            const stageProbability = stageDeals.length > 0
              ? Math.round(stageDeals.reduce((sum, d) => sum + d.winProbability, 0) / stageDeals.length)
              : 0;

            return (
              <div
                key={stage.key}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(stage.key)}
                className={`card border-2 ${stage.color} min-h-screen flex flex-col`}
              >
                {/* Stage Header */}
                <div className="p-4 border-b border-gray-200 sticky top-0 bg-white">
                  <h2 className="font-bold text-sm mb-2">{stage.label}</h2>
                  <div className="space-y-1 text-xs text-gray-600">
                    <p>Deals: {stageDeals.length}</p>
                    <p>Value: {formatCurrency(stageValue)}</p>
                    <p>Avg Prob: {stageProbability}%</p>
                  </div>
                </div>

                {/* Deal Cards */}
                <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                  {stageDeals.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">No deals</p>
                  ) : (
                    stageDeals.map((deal) => (
                      <div
                        key={deal.id}
                        draggable
                        onDragStart={() => handleDragStart(deal)}
                        className="bg-white p-3 rounded border border-gray-300 cursor-move hover:shadow-md transition-shadow"
                      >
                        <Link href={`/pipeline/${deal.id}`} className="block">
                          <p className="font-medium text-sm hover:text-blue-600">{deal.dealName}</p>
                          <p className="text-xs text-gray-600">{deal.customer.companyName}</p>
                        </Link>

                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">{formatCurrency(deal.dealValue)}</span>
                            <span className={`badge px-2 py-0.5 rounded text-xs font-medium ${getProbabilityColor(deal.winProbability)}`}>
                              {deal.winProbability}%
                            </span>
                          </div>

                          {deal.expectedCloseDate && (
                            <p className="text-xs text-gray-500">
                              Due: {new Date(deal.expectedCloseDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>

                        <div className="mt-2 flex gap-1">
                          <button
                            onClick={() => handleDeleteDeal(deal.id)}
                            className="text-red-600 hover:text-red-800 text-xs font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
