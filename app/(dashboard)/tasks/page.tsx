'use client';

import Link from 'next/link';

export default function TasksPage() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Tasks</h1>
        <Link href="/tasks/new" className="btn btn-primary">+ New Task</Link>
      </div>

      <div className="card p-6">
        <p className="text-gray-600">Tasks list will be displayed here</p>
      </div>
    </div>
  );
}
