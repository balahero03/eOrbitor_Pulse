'use client';

import Link from 'next/link';

export default function OrdersPage() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Orders</h1>
        <Link href="/orders/new" className="btn btn-primary">+ New Order</Link>
      </div>

      <div className="card p-6">
        <p className="text-gray-600">Orders list will be displayed here</p>
      </div>
    </div>
  );
}
