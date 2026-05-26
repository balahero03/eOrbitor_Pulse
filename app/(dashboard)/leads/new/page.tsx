'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// New leads always start as Suspect
const INITIAL_STATUS = 'SUSPECT';

interface User {
  id: string;
  firstName: string;
  lastName: string;
}

export default function NewLeadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    source: 'EMAIL',
    status: INITIAL_STATUS,
    quoteNo: '',
    quoteValue: '',
    rfqDate: '',
    followUpDate: '',
    remarks: '',
    assignedToId: '',
    broughtById: '',
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setUsers(d.users || d))
      .catch(() => {});
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const payload: any = { ...formData };
      if (!payload.email) delete payload.email;
      if (!payload.phone) delete payload.phone;
      if (!payload.quoteNo) delete payload.quoteNo;
      if (!payload.quoteValue) delete payload.quoteValue;
      if (!payload.rfqDate) delete payload.rfqDate;
      if (!payload.followUpDate) delete payload.followUpDate;
      if (!payload.remarks) delete payload.remarks;
      if (!payload.assignedToId) delete payload.assignedToId;
      if (!payload.broughtById) delete payload.broughtById;

      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to create lead');
      }

      const newLead = await res.json();
      router.push(`/leads/${newLead.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">New Lead</h1>
        <Link href="/leads" className="btn btn-secondary">Back to Leads</Link>
      </div>

      <div className="card p-8 max-w-3xl">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Opportunity & Customer */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">Opportunity Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Opportunity Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Solar Panel Supply - Phase 1"
                  required
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Customer / Company *</label>
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  placeholder="e.g. ABC Industries"
                  required
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <div className="flex items-center gap-2 border rounded px-3 py-2 bg-indigo-50">
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800">Suspect</span>
                  <span className="text-xs text-gray-500">All new leads start as Suspect</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Source</label>
                <select
                  name="source"
                  value={formData.source}
                  onChange={handleChange}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="EMAIL">Email</option>
                  <option value="REFERRAL">Referral</option>
                  <option value="WALKIN">Walk-in</option>
                  <option value="CALL">Phone Call</option>
                  <option value="WEBSITE">Website</option>
                  <option value="ADVERTISEMENT">Advertisement</option>
                </select>
              </div>
            </div>
          </div>

          {/* Quote Details */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">Quote Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Quote No (S.NO)</label>
                <input
                  type="text"
                  name="quoteNo"
                  value={formData.quoteNo}
                  onChange={handleChange}
                  placeholder="e.g. Q-2024-001"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Quote Value (₹)</label>
                <input
                  type="number"
                  name="quoteValue"
                  value={formData.quoteValue}
                  onChange={handleChange}
                  placeholder="e.g. 500000"
                  min="0"
                  step="0.01"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">RFQ Date</label>
                <input
                  type="date"
                  name="rfqDate"
                  value={formData.rfqDate}
                  onChange={handleChange}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Follow-up Date</label>
                <input
                  type="date"
                  name="followUpDate"
                  value={formData.followUpDate}
                  onChange={handleChange}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
          </div>

          {/* Team */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">Team Assignment</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Account Manager (Assigned To)</label>
                <select
                  name="assignedToId"
                  value={formData.assignedToId}
                  onChange={handleChange}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">— Current User —</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Sourced By (Brought By)</label>
                <select
                  name="broughtById"
                  value={formData.broughtById}
                  onChange={handleChange}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">— Same as Account Manager —</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">Contact Info (Optional)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="contact@company.com"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-sm font-medium mb-1">Remarks / Notes</label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              placeholder="Any additional notes about this lead..."
              rows={3}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary flex-1"
            >
              {loading ? 'Creating...' : 'Create Lead'}
            </button>
            <Link href="/leads" className="btn btn-secondary flex-1 text-center">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
