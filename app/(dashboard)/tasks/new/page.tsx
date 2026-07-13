'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';

interface Deal {
  id: string;
  dealName: string;
  customer: { companyName: string };
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  managerId?: string | null;
}

export default function NewTaskPage() {
  const router = useRouter();
  const { user: currentUser } = useCurrentUser();
  // Read the mode flag directly from the URL rather than via useSearchParams,
  // which would force this page out of static rendering — this page is
  // entirely client-rendered already, so a plain read on mount is simpler.
  const [isAssignMode, setIsAssignMode] = useState(false);
  useEffect(() => {
    setIsAssignMode(new URLSearchParams(window.location.search).get('assign') === '1');
  }, []);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'TODO',
    priority: 'MEDIUM',
    dueDate: '',
    assignedToId: '',
    relatedDealId: '',
    tags: '',
  });

  useEffect(() => {
    fetchDeals();
    fetchUsers();
  }, []);

  const fetchDeals = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/deals?limit=1000', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch deals');

      const data = await res.json();
      setDeals(data.deals);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/users?active=true', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch users');

      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // New Task always goes to yourself; Assign Task uses whoever was
      // picked in the (self-excluded) dropdown.
      const assignedToId = isAssignMode ? formData.assignedToId : currentUser?.id;

      if (!formData.title || !assignedToId) {
        throw new Error(isAssignMode ? 'Title and an assignee are required' : 'Title is required');
      }
      if (formData.dueDate && formData.dueDate < new Date().toLocaleDateString('en-CA')) {
        throw new Error('Due date cannot be in the past');
      }

      const token = localStorage.getItem('token');
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description || null,
          status: formData.status,
          priority: formData.priority,
          dueDate: formData.dueDate || null,
          assignedToId,
          relatedDealId: formData.relatedDealId || null,
          tags: formData.tags.split(',').map(t => t.trim()).filter(t => t),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to create task');
      }

      const newTask = await res.json();
      router.push(`/tasks/${newTask.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Mirrors the server-side assignment rule: admins assign to anyone; a
  // manager to themselves or their direct reports; everyone else to themselves.
  const assignableUsers = !currentUser
    ? []
    : ['SUPER_ADMIN', 'ADMIN'].includes(currentUser.role)
    ? users
    : currentUser.role === 'BACKEND_TEAM'
    ? users.filter(u => u.id === currentUser.id || u.managerId === currentUser.id)
    : users.filter(u => u.id === currentUser.id);

  // Assign mode is specifically for handing work to someone else — exclude
  // yourself so the picker can't be used to just recreate "New Task".
  const otherAssignableUsers = assignableUsers.filter(u => u.id !== currentUser?.id);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{isAssignMode ? 'Assign Task' : 'Create New Task'}</h1>
        <Link href="/tasks" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Back to Tasks</Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-1">Task Title *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Follow up with customer"
              required
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Task details..."
              className="w-full h-24"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full"
              >
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Due Date</label>
              <input
                type="date"
                name="dueDate"
                value={formData.dueDate}
                onChange={handleChange}
                min={new Date().toLocaleDateString('en-CA')}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Assign To *</label>
              {!isAssignMode ? (
                <div className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                  You{currentUser ? ` (${currentUser.firstName} ${currentUser.lastName})` : ''}
                </div>
              ) : otherAssignableUsers.length === 0 ? (
                <div className="w-full px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                  You have no one to assign to yet.
                </div>
              ) : (
                <select
                  name="assignedToId"
                  value={formData.assignedToId}
                  onChange={handleChange}
                  required
                  className="w-full"
                >
                  <option value="">Select a user</option>
                  {otherAssignableUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Related Deal</label>
            <select
              name="relatedDealId"
              value={formData.relatedDealId}
              onChange={handleChange}
              className="w-full"
            >
              <option value="">No related deal</option>
              {deals.map(d => (
                <option key={d.id} value={d.id}>
                  {d.dealName} - {d.customer.companyName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Tags (comma separated)</label>
            <input
              type="text"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              placeholder="urgent, follow-up, important"
              className="w-full"
            />
          </div>

          <div className="flex gap-4 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading || (isAssignMode && otherAssignableUsers.length === 0)}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? (isAssignMode ? 'Assigning...' : 'Creating...') : (isAssignMode ? 'Assign Task' : 'Create Task')}
            </button>
            <Link href="/tasks" className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 text-center">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
