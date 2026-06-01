'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Customer { id: string; companyName: string; }
interface Deal { id: string; dealName: string; }
interface User { id: string; firstName: string; lastName: string; role: string; }

export default function NewTicketPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [supportAgents, setSupportAgents] = useState<User[]>([]);
  const [formData, setFormData] = useState({
    customerId: '',
    dealId: '',
    type: 'GENERAL',
    priority: 'MEDIUM',
    subject: '',
    description: '',
    assignedToId: '',
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(u => {
        setCurrentUser(u);
        if (['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER'].includes(u.role)) {
          fetchSupportAgents(token!);
        }
      })
      .catch(console.error);
    fetchCustomersAndDeals();
  }, []);

  const fetchSupportAgents = async (token: string) => {
    try {
      const res = await fetch('/api/users?role=SUPPORT&limit=100', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSupportAgents(data.users || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCustomersAndDeals = async () => {
    try {
      const token = localStorage.getItem('token');
      const [customersRes, dealsRes] = await Promise.all([
        fetch('/api/customers?limit=1000', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/deals?limit=1000', { headers: { Authorization: `Bearer ${token}` } }),
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
      console.error(err);
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
      const body: any = {
        customerId: formData.customerId,
        dealId: formData.dealId || null,
        type: formData.type,
        priority: formData.priority,
        subject: formData.subject,
        description: formData.description,
      };

      if (formData.assignedToId) {
        body.assignedToId = formData.assignedToId;
      }

      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
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

  const canAssign = currentUser && ['SUPER_ADMIN', 'ADMIN', 'SALES_MANAGER'].includes(currentUser.role);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Create New Ticket</h1>
        <Link href="/support" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Back to Support</Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 max-w-3xl">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-1">Customer *</label>
            <select name="customerId" value={formData.customerId} onChange={handleChange} required className="w-full border rounded-lg px-3 py-2">
              <option value="">Select a customer</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.companyName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Related Deal (Optional)</label>
            <select name="dealId" value={formData.dealId} onChange={handleChange} className="w-full border rounded-lg px-3 py-2">
              <option value="">No related deal</option>
              {deals.map(d => (
                <option key={d.id} value={d.id}>{d.dealName}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Type *</label>
              <select name="type" value={formData.type} onChange={handleChange} className="w-full border rounded-lg px-3 py-2">
                <option value="GENERAL">General</option>
                <option value="TECHNICAL">Technical</option>
                <option value="BILLING">Billing</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Priority *</label>
              <select name="priority" value={formData.priority} onChange={handleChange} className="w-full border rounded-lg px-3 py-2">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>

          {canAssign && (
            <div>
              <label className="block text-sm font-medium mb-1">Assign To (Support Agent)</label>
              <select name="assignedToId" value={formData.assignedToId} onChange={handleChange} className="w-full border rounded-lg px-3 py-2">
                <option value="">Self-assign</option>
                {supportAgents.map(u => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Leave blank to assign to yourself</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Subject *</label>
            <input
              type="text"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              placeholder="Brief description of the issue"
              required
              className="w-full border rounded-lg px-3 py-2"
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
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div className="flex gap-4 pt-4 border-t border-gray-200">
            <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Creating...' : 'Create Ticket'}
            </button>
            <Link href="/support" className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 text-center">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
