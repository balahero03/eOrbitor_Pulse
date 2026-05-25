'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface SalesReport {
  period: { startDate: string; endDate: string };
  pipeline: {
    totalValue: number;
    byStage: Array<{ stage: string; count: number; value: number }>;
  };
  deals: {
    total: number;
    won: number;
    lost: number;
    active: number;
    wonValue: number;
    lostValue: number;
    winRate: number;
  };
  revenue: {
    completed: number;
    ordersCount: number;
    averageOrderValue: number;
  };
}

export default function SalesDashboardPage() {
  const [report, setReport] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchSalesReport();
  }, [startDate, endDate]);

  const fetchSalesReport = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        startDate,
        endDate,
      });

      const res = await fetch(`/api/reports/sales?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch sales report');

      const data = await res.json();
      setReport(data);
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

  if (!report) {
    return <div className="p-6 text-center">No data available</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Sales Dashboard</h1>
        <Link href="/reports" className="btn btn-secondary">Back to Reports</Link>
      </div>

      {/* Date Range Filter */}
      <div className="card p-4 mb-6">
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-40"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm font-medium">Total Deals</p>
          <p className="text-3xl font-bold text-blue-700">{report.deals.total}</p>
        </div>
        <div className="card p-6 bg-gradient-to-br from-green-50 to-green-100 border-l-4 border-green-500">
          <p className="text-gray-600 text-sm font-medium">Deals Won</p>
          <p className="text-3xl font-bold text-green-700">{report.deals.won}</p>
        </div>
        <div className="card p-6 bg-gradient-to-br from-red-50 to-red-100 border-l-4 border-red-500">
          <p className="text-gray-600 text-sm font-medium">Deals Lost</p>
          <p className="text-3xl font-bold text-red-700">{report.deals.lost}</p>
        </div>
        <div className="card p-6 bg-gradient-to-br from-purple-50 to-purple-100 border-l-4 border-purple-500">
          <p className="text-gray-600 text-sm font-medium">Win Rate</p>
          <p className="text-3xl font-bold text-purple-700">{report.deals.winRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* Pipeline and Revenue */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Pipeline by Stage */}
        <div className="card p-6">
          <h2 className="text-xl font-bold mb-4">Pipeline by Stage</h2>
          <div className="space-y-4">
            {report.pipeline.byStage.map((stage) => (
              <div key={stage.stage}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">{stage.stage}</p>
                  <div className="text-right">
                    <p className="text-sm font-bold text-blue-600">{formatCurrency(stage.value)}</p>
                    <p className="text-xs text-gray-500">{stage.count} deals</p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{
                      width: `${report.pipeline.totalValue > 0
                        ? (stage.value / report.pipeline.totalValue) * 100
                        : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            ))}
            <div className="pt-3 border-t border-gray-200 mt-3">
              <p className="text-sm font-medium text-gray-600">Total Pipeline</p>
              <p className="text-2xl font-bold text-blue-700">{formatCurrency(report.pipeline.totalValue)}</p>
            </div>
          </div>
        </div>

        {/* Revenue Metrics */}
        <div className="space-y-4">
          <div className="card p-6 bg-green-50 border-l-4 border-green-500">
            <p className="text-gray-600 text-sm font-medium">Completed Revenue</p>
            <p className="text-3xl font-bold text-green-700 mb-2">
              {formatCurrency(report.revenue.completed)}
            </p>
            <p className="text-xs text-gray-600">{report.revenue.ordersCount} orders</p>
          </div>

          <div className="card p-6">
            <h3 className="font-bold mb-3">Deal Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <p className="text-gray-600">Active Deals</p>
                <p className="font-medium">{report.deals.active}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-600">Won Value</p>
                <p className="font-medium text-green-600">{formatCurrency(report.deals.wonValue)}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-600">Lost Value</p>
                <p className="font-medium text-red-600">{formatCurrency(report.deals.lostValue)}</p>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <p className="text-gray-600">Avg Order Value</p>
                <p className="font-medium">{formatCurrency(Number(report.revenue.averageOrderValue))}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
