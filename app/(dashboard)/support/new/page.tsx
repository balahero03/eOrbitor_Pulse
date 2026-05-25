'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Customer {
  id: string;
  companyName: string;
}

interface Deal {
  id: string;
  dealName: string;
}

export default function NewTicketPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [formData, setFormData] = useState({
    customerId: '',
    dealId: '',
    type: 'GENERAL',
    priority: 'MEDIUM',
    subject: '',
    description: '',
  });

  useEffect(() => {
    fetchCustomersAndDeals();
  }, []);

  const fetchCustomersAndDeals = async () => {
    try {
      const token = localStorage.getItem('token');
      const [customersRes, dealsRes] = await Promise.all([
        fetch('/api/customers?limit=1000', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/deals?limit=1000', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (customersRes.ok) {
        const data = await customersRes.json();
        setCustomers(data.customers || []);
      }
      if (dealsRes.ok) {
        const data = await dealsRes.json();
        setDeals(data.deals || []);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!formData.customerId || !formData.subject || !formData.description) {
        throw new Error('Customer, subject, and description are required');
      }

      const token = localStorage.getItem('token');
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customerId: formData.customerId,
          dealId: formData.dealId || null,
          type: formData.type,
          priority: formData.priority,
          subject: formData.subject,
          description: formData.description,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to create ticket');
      }

      const newTicket = await res.json();
      router.push(`/support/${newTicket.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Create New Ticket</h1>
        <Link href="/support" className="btn btn-secondary">Back to Support</Link>
      </div>

      <div className="card p-8 max-w-3xl">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
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

          <div>
            <label className="block text-sm font-medium mb-1">Related Deal (Optional)</label>
            <select
              name="dealId"
              value={formData.dealId}
              onChange={handleChange}
              className="w-full"
            >
              <option value="">No related deal</option>
              {deals.map(d => (
                <option key={d.id} value={d.id}>{d.dealName}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Type *</label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="w-full"
              >
                <option value="GENERAL">General</option>
                <option value="TECHNICAL">Technical</option>
                <option value="BILLING">Billing</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Priority *</label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="w-full"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Subject *</label>
            <input
              type="text"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              placeholder="Brief description of the issue"
              required
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description *</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Detailed description of the issue"
              required
              rows={6}
              className="w-full"
            />
          </div>

          <div className="flex gap-4 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary flex-1"
            >
              {loading ? 'Creating...' : 'Create Ticket'}
            </button>
            <Link href="/support" className="btn btn-secondary flex-1 text-center">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
