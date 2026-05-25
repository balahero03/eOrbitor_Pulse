'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface RevenueReport {
  period: { startDate: string; endDate: string };
  revenue: {
    completed: number;
    pending: number;
    paid: number;
    unpaid: number;
  };
  orders: {
    byStatus: Array<{ status: string; count: number; value: number }>;
    byPaymentStatus: Array<{ status: string; count: number; value: number }>;
  };
  topCustomers: Array<{
    customerId: string;
    customerName: string;
    orders: number;
    totalRevenue: number;
  }>;
}

export default function RevenueAnalysisPage() {
  const [report, setReport] = useState<RevenueReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchRevenueReport();
  }, [startDate, endDate]);

  const fetchRevenueReport = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ startDate, endDate });

      const res = await fetch(`/api/reports/revenue?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch revenue report');

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
        <h1 className="text-3xl font-bold">Revenue Analysis</h1>
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

      {/* Revenue KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card p-6 bg-gradient-to-br from-green-50 to-green-100 border-l-4 border-green-500">
          <p className="text-gray-600 text-sm font-medium">Completed Revenue</p>
          <p className="text-2xl font-bold text-green-700">{formatCurrency(report.revenue.completed)}</p>
        </div>
        <div className="card p-6 bg-gradient-to-br from-yellow-50 to-yellow-100 border-l-4 border-yellow-500">
          <p className="text-gray-600 text-sm font-medium">Pending Revenue</p>
          <p className="text-2xl font-bold text-yellow-700">{formatCurrency(report.revenue.pending)}</p>
        </div>
        <div className="card p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm font-medium">Paid Revenue</p>
          <p className="text-2xl font-bold text-blue-700">{formatCurrency(report.revenue.paid)}</p>
        </div>
        <div className="card p-6 bg-gradient-to-br from-red-50 to-red-100 border-l-4 border-red-500">
          <p className="text-gray-600 text-sm font-medium">Unpaid Revenue</p>
          <p className="text-2xl font-bold text-red-700">{formatCurrency(report.revenue.unpaid)}</p>
        </div>
      </div>

      {/* Order Status and Payment Status */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Orders by Status */}
        <div className="card p-6">
          <h2 className="text-xl font-bold mb-4">Orders by Status</h2>
          <div className="space-y-3">
            {report.orders.byStatus.map((status) => (
              <div key={status.status}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">{status.status}</p>
                  <div className="text-right">
                    <p className="text-sm font-bold text-blue-600">{status.count}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(status.value)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Status */}
        <div className="card p-6">
          <h2 className="text-xl font-bold mb-4">Payment Status</h2>
          <div className="space-y-3">
            {report.orders.byPaymentStatus.map((ps) => (
              <div key={ps.status}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">{ps.status}</p>
                  <div className="text-right">
                    <p className="text-sm font-bold text-blue-600">{ps.count}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(ps.value)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Customers */}
      <div className="card p-6">
        <h2 className="text-xl font-bold mb-4">Top Customers by Revenue</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Customer Name</th>
                <th className="px-4 py-2 text-left font-medium">Orders</th>
                <th className="px-4 py-2 text-left font-medium">Total Revenue</th>
                <th className="px-4 py-2 text-left font-medium">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {report.topCustomers.map((customer, idx) => {
                const totalRevenue = report.topCustomers.reduce((sum, c) => sum + Number(c.totalRevenue), 0);
                const share = totalRevenue > 0 ? (Number(customer.totalRevenue) / totalRevenue) * 100 : 0;

                return (
                  <tr key={customer.customerId} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">
                      <Link
                        href={`/customers/${customer.customerId}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {customer.customerName}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{customer.orders}</td>
                    <td className="px-4 py-2 font-medium text-blue-600">
                      {formatCurrency(Number(customer.totalRevenue))}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${share}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium">{share.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
