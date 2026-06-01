'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface TeamMetrics {
  userId: string;
  name: string;
  email: string;
  dealsAssigned: number;
  dealsWon: number;
  dealValue: number;
  leadsAssigned: number;
  leadsConverted: number;
  conversionRate: string;
  tasksCompleted: number;
}

interface TeamReport {
  period: { startDate: string; endDate: string };
  team: TeamMetrics[];
}

export default function TeamPerformancePage() {
  const [report, setReport] = useState<TeamReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchTeamReport();
  }, [startDate, endDate]);

  const fetchTeamReport = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ startDate, endDate });

      const res = await fetch(`/api/reports/team?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch team report');

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
        <h1 className="text-3xl font-bold">Team Performance</h1>
        <Link href="/reports" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Back to Reports</Link>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
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

      {/* Team Performance Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Team Member</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Deals Assigned</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Deals Won</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Deal Value</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Leads Assigned</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Converted</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Conversion Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Tasks Done</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {report.team.map((member) => (
                <tr key={member.userId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">
                    <div>
                      <p className="font-medium">{member.name}</p>
                      <p className="text-sm text-gray-600">{member.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center font-medium">{member.dealsAssigned}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-xs px-2.5 py-1 rounded-full border font-medium bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                      {member.dealsWon}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-blue-600">
                    {formatCurrency(Number(member.dealValue))}
                  </td>
                  <td className="px-6 py-4 text-center font-medium">{member.leadsAssigned}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-xs px-2.5 py-1 rounded-full border font-medium bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium">
                      {member.leadsConverted}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center font-medium">
                    <span className={`${
                      parseFloat(member.conversionRate) >= 20 ? 'text-green-600' :
                      parseFloat(member.conversionRate) >= 10 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {parseFloat(member.conversionRate).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center font-medium">{member.tasksCompleted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
