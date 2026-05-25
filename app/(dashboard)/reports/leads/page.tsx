'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface LeadsReport {
  period: { startDate: string; endDate: string };
  summary: {
    total: number;
    converted: number;
    newThisPeriod: number;
    conversionRate: number;
    averageScore: number;
  };
  bySource: Array<{ source: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  topSources: Array<{ source: string; count: number }>;
}

export default function LeadsAnalysisPage() {
  const [report, setReport] = useState<LeadsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchLeadsReport();
  }, [startDate, endDate]);

  const fetchLeadsReport = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ startDate, endDate });

      const res = await fetch(`/api/reports/leads?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch leads report');

      const data = await res.json();
      setReport(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  if (!report) {
    return <div className="p-6 text-center">No data available</div>;
  }

  const sourceTotal = report.bySource.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Lead Analysis</h1>
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
          <p className="text-gray-600 text-sm font-medium">Total Leads</p>
          <p className="text-3xl font-bold text-blue-700">{report.summary.total}</p>
        </div>
        <div className="card p-6 bg-gradient-to-br from-green-50 to-green-100 border-l-4 border-green-500">
          <p className="text-gray-600 text-sm font-medium">Converted</p>
          <p className="text-3xl font-bold text-green-700">{report.summary.converted}</p>
        </div>
        <div className="card p-6 bg-gradient-to-br from-purple-50 to-purple-100 border-l-4 border-purple-500">
          <p className="text-gray-600 text-sm font-medium">New This Period</p>
          <p className="text-3xl font-bold text-purple-700">{report.summary.newThisPeriod}</p>
        </div>
        <div className="card p-6 bg-gradient-to-br from-yellow-50 to-yellow-100 border-l-4 border-yellow-500">
          <p className="text-gray-600 text-sm font-medium">Conversion Rate</p>
          <p className="text-3xl font-bold text-yellow-700">{report.summary.conversionRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* Analysis Grid */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Lead Source Distribution */}
        <div className="card p-6">
          <h2 className="text-xl font-bold mb-4">Leads by Source</h2>
          <div className="space-y-3">
            {report.bySource.map((source) => {
              const percentage = sourceTotal > 0 ? (source.count / sourceTotal) * 100 : 0;
              return (
                <div key={source.source}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium">{source.source}</p>
                    <p className="text-sm font-bold text-blue-600">{source.count}</p>
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
          </div>
        </div>

        {/* Lead Status Distribution */}
        <div className="card p-6">
          <h2 className="text-xl font-bold mb-4">Leads by Status</h2>
          <div className="space-y-3">
            {report.byStatus.map((status) => (
              <div key={status.status} className="flex items-center justify-between pb-2 border-b border-gray-200">
                <p className="text-sm font-medium">{status.status}</p>
                <div className="text-right">
                  <p className="text-lg font-bold text-blue-600">{status.count}</p>
                  <p className="text-xs text-gray-500">
                    {((status.count / report.summary.total) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lead Quality Metrics */}
      <div className="card p-6">
        <h2 className="text-xl font-bold mb-4">Lead Quality Metrics</h2>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-gray-600 text-sm mb-2">Average Lead Score</p>
            <p className="text-3xl font-bold text-blue-700">{report.summary.averageScore.toFixed(1)}</p>
            <p className="text-xs text-gray-500 mt-1">out of 100</p>
          </div>
          <div>
            <p className="text-gray-600 text-sm mb-2">Conversion Rate</p>
            <p className="text-3xl font-bold text-green-700">{report.summary.conversionRate.toFixed(1)}%</p>
            <p className="text-xs text-gray-500 mt-1">of total leads</p>
          </div>
          <div>
            <p className="text-gray-600 text-sm mb-2">Top Lead Source</p>
            <p className="text-2xl font-bold text-purple-700">
              {report.topSources[0]?.source || 'N/A'}
            </p>
            <p className="text-xs text-gray-500 mt-1">{report.topSources[0]?.count || 0} leads</p>
          </div>
        </div>
      </div>
    </div>
  );
}
