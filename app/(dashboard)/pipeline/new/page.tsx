'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Customer {
  id: string;
  companyName: string;
}

export default function NewDealPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    dealName: '',
    customerId: '',
    dealValue: '',
    winProbability: '50',
    stage: 'SUSPECT',
    expectedCloseDate: '',
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/customers?limit=1000', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch customers');

      const data = await res.json();
      setCustomers(data.customers);
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dealName: formData.dealName,
          customerId: formData.customerId,
          dealValue: parseInt(formData.dealValue),
          winProbability: parseInt(formData.winProbability),
          stage: formData.stage,
          expectedCloseDate: formData.expectedCloseDate || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to create deal');
      }

      const newDeal = await res.json();
      router.push(`/pipeline/${newDeal.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Create New Deal</h1>
        <Link href="/pipeline" className="btn btn-secondary">Back to Pipeline</Link>
      </div>

      <div className="card p-8 max-w-2xl">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Deal Info */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Deal Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Deal Name *</label>
                <input
                  type="text"
                  name="dealName"
                  value={formData.dealName}
                  onChange={handleChange}
                  placeholder="Enterprise License - Q3 2026"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Customer *</label>
                <select
                  name="customerId"
                  value={formData.customerId}
                  onChange={handleChange}
                  required
                  className="w-full"
                >
                  <option value="">Select a customer</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.companyName}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Deal Value *</label>
                  <input
                    type="number"
                    name="dealValue"
                    value={formData.dealValue}
                    onChange={handleChange}
                    placeholder="500000"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Win Probability %</label>
                  <input
                    type="number"
                    name="winProbability"
                    value={formData.winProbability}
                    onChange={handleChange}
                    min="0"
                    max="100"
                    placeholder="50"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Pipeline Info */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Pipeline Stage</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Current Stage</label>
                <select
                  name="stage"
                  value={formData.stage}
                  onChange={handleChange}
                  className="w-full"
                >
                  <option value="SUSPECT">Suspect</option>
                  <option value="PROSPECT">Prospect</option>
                  <option value="APPROACH">Approach</option>
                  <option value="NEGOTIATION">Negotiation</option>
                  <option value="CLOSURE">Closure</option>
                  <option value="ONGOING">Ongoing</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Expected Closure Date</label>
                <input
                  type="date"
                  name="expectedCloseDate"
                  value={formData.expectedCloseDate}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary flex-1"
            >
              {loading ? 'Creating...' : 'Create Deal'}
            </button>
            <Link href="/pipeline" className="btn btn-secondary flex-1 text-center">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
