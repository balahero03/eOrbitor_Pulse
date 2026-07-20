'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import RichTextEditor from '@/components/RichTextEditor';

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

  const assignableUsers = !currentUser
    ? []
    : ['SUPER_ADMIN', 'ADMIN'].includes(currentUser.role)
    ? users
    : currentUser.role === 'BACKEND_TEAM'
    ? users.filter(u => u.id === currentUser.id || u.managerId === currentUser.id)
    : users.filter(u => u.id === currentUser.id);

  const otherAssignableUsers = assignableUsers.filter(u => u.id !== currentUser?.id);

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {isAssignMode ? 'Assign New Task' : 'Create New Task'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isAssignMode
              ? 'Delegate work to team members with complete descriptions and checklists.'
              : 'Add a new task to your workspace with rich text details.'}
          </p>
        </div>
        <Link
          href="/tasks"
          className="self-start sm:self-center inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Tasks
        </Link>
      </div>

      {/* Main Form Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6 sm:p-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Task Title Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1.5">
              Task Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. Follow up with client regarding proposal approval"
              required
              className="w-full text-base font-medium px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:font-normal"
            />
          </div>

          {/* Description Section (Enlarged Canvas) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-semibold text-gray-800">
                Description & Checklists
              </label>
              <span className="text-xs text-gray-400 font-normal">Rich Text Supported</span>
            </div>
            <RichTextEditor
              value={formData.description}
              onChange={(content) => setFormData(prev => ({ ...prev, description: content }))}
              placeholder="Provide context, action items, task checklists, or code snippets..."
              minHeight="280px"
              className="shadow-xs"
            />
          </div>

          {/* Configuration Grid */}
          <div className="pt-4 border-t border-gray-100 space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Task Details & Metadata</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input
                  type="date"
                  name="dueDate"
                  value={formData.dueDate}
                  onChange={handleChange}
                  min={new Date().toLocaleDateString('en-CA')}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign To <span className="text-red-500">*</span>
                </label>
                {!isAssignMode ? (
                  <div className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-medium">
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
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Related Deal</label>
                <select
                  name="relatedDealId"
                  value={formData.relatedDealId}
                  onChange={handleChange}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  name="tags"
                  value={formData.tags}
                  onChange={handleChange}
                  placeholder="urgent, follow-up, important"
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Form Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
            <Link
              href="/tasks"
              className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || (isAssignMode && otherAssignableUsers.length === 0)}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-xs"
            >
              {loading ? (isAssignMode ? 'Assigning...' : 'Creating...') : (isAssignMode ? 'Assign Task' : 'Create Task')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
