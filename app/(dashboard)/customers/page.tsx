'use client';

import Link from 'next/link';

export default function CustomersPage() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Customers</h1>
        <Link href="/customers/new" className="btn btn-primary">+ New Customer</Link>
      </div>

      <div className="card p-6">
        <p className="text-gray-600">Customer list will be displayed here</p>
      </div>
    </div>
  );
}
