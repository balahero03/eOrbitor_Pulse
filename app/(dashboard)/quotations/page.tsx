'use client';

import Link from 'next/link';

export default function QuotationsPage() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Quotations</h1>
        <Link href="/quotations/new" className="btn btn-primary">+ New Quotation</Link>
      </div>

      <div className="card p-6">
        <p className="text-gray-600">Quotations list will be displayed here</p>
      </div>
    </div>
  );
}
