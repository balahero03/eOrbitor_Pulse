'use client';

export default function ReportsPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Reports & Analytics</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-6">
          <h3 className="font-bold mb-2">Sales Dashboard</h3>
          <p className="text-gray-600 text-sm">Pipeline value by stage, win rate, average deal size</p>
        </div>
        <div className="card p-6">
          <h3 className="font-bold mb-2">Revenue Report</h3>
          <p className="text-gray-600 text-sm">Monthly revenue trend, revenue by customer, product performance</p>
        </div>
      </div>
    </div>
  );
}
