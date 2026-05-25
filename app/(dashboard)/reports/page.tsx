'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface DashboardData {
  kpis: {
    totalLeads: number;
    totalCustomers: number;
    activeDeals: number;
    totalRevenue: number;
    openTickets: number;
    overdueTasks: number;
  };
  pipeline: Array<{ stage: string; value: number }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    amount: number;
    status: string;
    createdAt: string;
  }>;
}

export default function ReportsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/reports/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch dashboard');

      const data = await res.json();
      setData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  if (!data) {
    return <div className="p-6 text-center">No data available</div>;
  }

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
        <div className="card p-6 bg-gradient-to-br from-yellow-50 to-yellow-100 border-l-4 border-yellow-500">
          <p className="text-gray-600 text-sm font-medium">This Month Revenue</p>
          <p className="text-2xl font-bold text-yellow-700">{formatCurrency(data.kpis.totalRevenue)}</p>
        </div>
        <div className="card p-6 bg-gradient-to-br from-red-50 to-red-100 border-l-4 border-red-500">
          <p className="text-gray-600 text-sm font-medium">Open Tickets</p>
          <p className="text-4xl font-bold text-red-700">{data.kpis.openTickets}</p>
        </div>
        <div className="card p-6 bg-gradient-to-br from-orange-50 to-orange-100 border-l-4 border-orange-500">
          <p className="text-gray-600 text-sm font-medium">Overdue Tasks</p>
          <p className="text-4xl font-bold text-orange-700">{data.kpis.overdueTasks}</p>
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Pipeline Value */}
        <div className="card p-6">
          <h2 className="text-xl font-bold mb-4">Pipeline Value by Stage</h2>
          <div className="space-y-3">
            {data.pipeline.map((p) => {
              const percentage = pipelineTotal > 0 ? (p.value / pipelineTotal) * 100 : 0;
              return (
                <div key={p.stage}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium">{p.stage}</p>
                    <p className="text-sm font-bold text-blue-600">{formatCurrency(p.value)}</p>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="pt-3 border-t border-gray-200 mt-3">
              <p className="text-sm font-medium text-gray-600">Total Pipeline Value</p>
              <p className="text-2xl font-bold text-blue-700">{formatCurrency(pipelineTotal)}</p>
            </div>
          </div>
        </div>

        {/* Report Links */}
        <div className="space-y-3">
          <Link href="/reports/sales" className="card p-6 hover:shadow-lg transition block">
            <h3 className="text-lg font-bold mb-2">Sales Dashboard</h3>
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

      {/* Recent Orders */}
      <div className="card p-6">
        <h2 className="text-xl font-bold mb-4">Recent Orders</h2>
        {data.recentOrders.length === 0 ? (
          <p className="text-gray-600">No orders this period</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Order #</th>
                  <th className="px-4 py-2 text-left font-medium">Customer</th>
                  <th className="px-4 py-2 text-left font-medium">Amount</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-blue-600">
                      <Link href={`/orders/${order.id}`} className="hover:text-blue-800">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{order.customerName}</td>
                    <td className="px-4 py-2 font-medium">{formatCurrency(Number(order.amount))}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`badge px-2 py-1 rounded text-xs font-medium ${
                          order.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
