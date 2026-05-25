'use client';

import { useState, useEffect } from 'react';

interface KPI {
  label: string;
  value: string | number;
  icon: string;
  color: string;
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/dashboard', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setKpis([
          { label: 'Total Leads', value: data.totalLeads, icon: '👥', color: 'blue' },
          { label: 'Active Deals', value: data.activeDeals, icon: '📈', color: 'green' },
          { label: 'Pending Tasks', value: data.pendingTasks, icon: '✓', color: 'yellow' },
          { label: 'Revenue (YTD)', value: `₹${data.yTDRevenue?.toLocaleString()}`, icon: '💰', color: 'purple' },
        ]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((kpi, idx) => (
          <div key={idx} className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">{kpi.label}</p>
                <p className="text-3xl font-bold mt-2">{kpi.value}</p>
              </div>
              <div className="text-4xl">{kpi.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="card p-6">
        <h2 className="text-lg font-bold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <a href="/leads/new" className="btn btn-primary text-center">+ New Lead</a>
          <a href="/customers/new" className="btn btn-primary text-center">+ New Customer</a>
          <a href="/pipeline" className="btn btn-secondary text-center">View Pipeline</a>
          <a href="/tasks" className="btn btn-secondary text-center">View Tasks</a>
        </div>
      </div>
    </div>
  );
}
