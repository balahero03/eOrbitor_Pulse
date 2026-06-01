'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRequireRole } from '@/lib/hooks/useRequireRole';

interface DashboardData {
  role: string;
  kpis: {
    totalLeads: number;
    totalCustomers: number;
    activeDeals: number;
    openTickets: number;
    overdueTasks: number;
  };
  pipeline: Array<{ stage: string; value: number; count: number }>;
}

export default function ReportsPage() {
  useRequireRole(['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER']);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/reports/dashboard', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const fmt = (value: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

  if (loading) return <div className="p-6 text-center text-gray-500">Loading reports...</div>;
  if (!data || !data.kpis) return <div className="p-6 text-center text-gray-500">No data available</div>;

  const pipelineTotal = data.pipeline.reduce((sum, p) => sum + p.value, 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Reports & Analytics</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm font-medium">Total Leads</p>
          <p className="text-4xl font-bold text-blue-700">{data.kpis.totalLeads}</p>
        </div>
        <div className="card p-6 bg-gradient-to-br from-green-50 to-green-100 border-l-4 border-green-500">
          <p className="text-gray-600 text-sm font-medium">Total Customers</p>
          <p className="text-4xl font-bold text-green-700">{data.kpis.totalCustomers}</p>
        </div>
        <div className="card p-6 bg-gradient-to-br from-purple-50 to-purple-100 border-l-4 border-purple-500">
          <p className="text-gray-600 text-sm font-medium">Active Deals</p>
          <p className="text-4xl font-bold text-purple-700">{data.kpis.activeDeals}</p>
        </div>
        <div className="card p-6 bg-gradient-to-br from-red-50 to-red-100 border-l-4 border-red-500">
          <p className="text-gray-600 text-sm font-medium">Open Tickets</p>
          <p className="text-4xl font-bold text-red-700">{data.kpis.openTickets}</p>
        </div>
        <div className="card p-6 bg-gradient-to-br from-orange-50 to-orange-100 border-l-4 border-orange-500">
          <p className="text-gray-600 text-sm font-medium">Overdue Tasks</p>
          <p className="text-4xl font-bold text-orange-700">{data.kpis.overdueTasks}</p>
        </div>
        <div className="card p-6 bg-gradient-to-br from-indigo-50 to-indigo-100 border-l-4 border-indigo-500">
          <p className="text-gray-600 text-sm font-medium">Pipeline Value</p>
          <p className="text-2xl font-bold text-indigo-700">{fmt(pipelineTotal)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Pipeline Value by Stage */}
        <div className="card p-6">
          <h2 className="text-xl font-bold mb-4">Pipeline by Stage</h2>
          {data.pipeline.length === 0 ? (
            <p className="text-gray-500 text-sm">No active deals in pipeline.</p>
          ) : (
            <div className="space-y-3">
              {data.pipeline.map(p => {
                const pct = pipelineTotal > 0 ? (p.value / pipelineTotal) * 100 : 0;
                return (
                  <div key={p.stage}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium">{p.stage} <span className="text-gray-400">({p.count})</span></p>
                      <p className="text-sm font-bold text-blue-600">{fmt(p.value)}</p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="pt-3 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-600">Total Pipeline Value</p>
                <p className="text-2xl font-bold text-blue-700">{fmt(pipelineTotal)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Report Links */}
        <div className="space-y-3">
          <Link href="/reports/sales" className="card p-6 hover:shadow-lg transition block">
            <h3 className="text-lg font-bold mb-2">Sales Report</h3>
            <p className="text-gray-600 text-sm">Pipeline, revenue, win rate, and deal analytics</p>
          </Link>
          <Link href="/reports/leads" className="card p-6 hover:shadow-lg transition block">
            <h3 className="text-lg font-bold mb-2">Lead Analysis</h3>
            <p className="text-gray-600 text-sm">Source distribution, conversion rate, and scoring</p>
          </Link>
          <Link href="/reports/team" className="card p-6 hover:shadow-lg transition block">
            <h3 className="text-lg font-bold mb-2">Team Performance</h3>
            <p className="text-gray-600 text-sm">Individual metrics, deals won, and productivity</p>
          </Link>
          <Link href="/reports/revenue" className="card p-6 hover:shadow-lg transition block">
            <h3 className="text-lg font-bold mb-2">Revenue Analysis</h3>
            <p className="text-gray-600 text-sm">Orders, payment status, and customer insights</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
