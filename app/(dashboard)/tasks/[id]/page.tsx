'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import RichTextEditor from '@/components/RichTextEditor';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  assignedTo: { id: string; firstName: string; lastName: string; email: string };
  relatedDeal?: { id: string; dealName: string };
  createdBy: { id: string; firstName: string; lastName: string };
  createdAt: string;
  completedAt?: string;
  tags: string[];
}

export default function TaskDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { user: currentUser } = useCurrentUser();
  const isAdminUser = !!currentUser && ['SUPER_ADMIN', 'ADMIN'].includes(currentUser.role);
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: '',
    priority: '',
    dueDate: '',
    tags: '',
  });

  useEffect(() => {
    fetchTask();
  }, [id]);

  const fetchTask = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/tasks/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch task');

      const data = await res.json();
      setTask(data);
      setFormData({
        title: data.title,
        description: data.description || '',
        status: data.status,
        priority: data.priority,
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString().split('T')[0] : '',
        tags: data.tags?.join(', ') || '',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          status: formData.status,
          priority: formData.priority,
          dueDate: formData.dueDate,
          tags: formData.tags.split(',').map(t => t.trim()).filter(t => t),
        }),
      });

      if (!res.ok) throw new Error('Failed to update task');

      const updated = await res.json();
      setTask(updated);
      setEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteTask = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/tasks/${id}/complete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to complete task');

      const updated = await res.json();
      setTask(updated);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to update status');
      }

      const updated = await res.json();
      setTask(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelTask = async () => {
    if (!confirm('Cancel this task?')) return;
    await handleStatusChange('CANCELLED');
  };

  const handleDeleteTask = async () => {
    if (!confirm('Delete this task?')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        router.push('/tasks');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'TODO': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'COMPLETED': return 'bg-green-100 text-green-800 border-green-200';
      case 'CANCELLED': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'LOW': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'MEDIUM': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'HIGH': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'URGENT': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const isOverdue = () => {
    if (!task?.dueDate || task.status === 'COMPLETED') return false;
    return new Date(task.dueDate) < new Date();
  };

  if (loading) return <div className="p-8 text-center text-gray-500 font-medium">Loading task...</div>;
  if (!task) return <div className="p-8 text-center text-gray-500 font-medium">Task not found</div>;

  const isAssignee = !!currentUser && currentUser.id === task.assignedTo?.id;
  const isCreator = !!currentUser && currentUser.id === task.createdBy?.id;
  const canUpdateStatus = isAssignee || isAdminUser;
  const canCancel = (isCreator || isAdminUser) && task.status !== 'CANCELLED' && task.status !== 'COMPLETED';

  const originBadge = !currentUser
    ? null
    : isCreator && isAssignee
    ? { label: 'Personal', className: 'bg-slate-100 text-slate-600 border-slate-200' }
    : isCreator
    ? { label: 'You assigned', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' }
    : isAssignee
    ? { label: 'Assigned to you', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
    : null;

  return (
    <div className="p-6 sm:p-8 max-w-6xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{task.title}</h1>
          {originBadge && (
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${originBadge.className}`}>
              {originBadge.label}
            </span>
          )}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Task Canvas (2 Columns) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header Card / Status Bar */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-4 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(task.status)}`}>
                  {task.status.replace('_', ' ')}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(task.priority)}`}>
                  {task.priority} Priority
                </span>
              </div>

              {!editing && isAdminUser && (
                <button
                  onClick={() => setEditing(true)}
                  className="px-4 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors inline-flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Task
                </button>
              )}
            </div>

            {/* Edit Mode Form */}
            {editing ? (
              <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1">Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    className="w-full text-base font-medium px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1">
                    Description & Checklists
                  </label>
                  <RichTextEditor
                    value={formData.description}
                    onChange={(content) => setFormData(prev => ({ ...prev, description: content }))}
                    placeholder="Task details..."
                    minHeight="280px"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
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
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
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
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
                    <input
                      type="text"
                      value={formData.tags}
                      onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                      placeholder="urgent, follow-up, important"
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-200 justify-end">
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-xs"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              /* View Mode Description & Meta */
              <div className="space-y-6">
                <div>
                  <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Description & Task Details</h2>
                  {task.description ? (
                    <div
                      className="text-gray-800 tiptap-rendered-content text-sm bg-gray-50/60 rounded-xl p-5 border border-gray-200/80 min-h-[220px]"
                      dangerouslySetInnerHTML={{ __html: task.description }}
                    />
                  ) : (
                    <p className="text-sm text-gray-400 italic py-6 text-center border border-dashed rounded-xl bg-gray-50/50">
                      No description provided for this task.
                    </p>
                  )}
                </div>

                {/* Due Date & Tags summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Due Date</p>
                    {task.dueDate ? (
                      <p className={`text-sm font-semibold ${isOverdue() ? 'text-red-600' : 'text-gray-800'}`}>
                        {new Date(task.dueDate).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                        {isOverdue() && <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold uppercase">Overdue</span>}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400">No due date set</p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Tags</p>
                    {task.tags && task.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {task.tags.map(tag => (
                          <span key={tag} className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full text-xs font-medium">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">No tags</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Controls (1 Column) */}
        <div className="space-y-6">
          {/* Assignment Panel */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6 space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Assignment Details</h3>
            {task.assignedTo ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm border border-blue-200">
                    {task.assignedTo.firstName[0]}{task.assignedTo.lastName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{task.assignedTo.firstName} {task.assignedTo.lastName}</p>
                    <p className="text-xs text-gray-500">{task.assignedTo.email}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Unassigned</p>
            )}
          </div>

          {/* Related Deal Link */}
          {task.relatedDeal && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6 space-y-2">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Related Deal</h3>
              <p className="text-sm font-semibold text-gray-800">{task.relatedDeal.dealName}</p>
            </div>
          )}

          {/* Actions Menu */}
          {(canUpdateStatus || canCancel || isAdminUser) && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6 space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Task Actions</h3>
              <div className="space-y-2">
                {canUpdateStatus && task.status === 'TODO' && (
                  <button
                    onClick={() => handleStatusChange('IN_PROGRESS')}
                    disabled={saving}
                    className="w-full py-2.5 border border-blue-300 text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors disabled:opacity-50"
                  >
                    Start Task (In Progress)
                  </button>
                )}

                {canUpdateStatus && task.status === 'IN_PROGRESS' && (
                  <button
                    onClick={() => handleStatusChange('TODO')}
                    disabled={saving}
                    className="w-full py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Move back to To Do
                  </button>
                )}

                {canUpdateStatus && task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && (
                  <button
                    onClick={handleCompleteTask}
                    disabled={saving}
                    className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors shadow-xs disabled:opacity-50"
                  >
                    Mark Complete
                  </button>
                )}

                {canCancel && (
                  <button
                    onClick={handleCancelTask}
                    disabled={saving}
                    className="w-full py-2.5 border border-red-300 text-red-700 rounded-lg text-sm font-semibold hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    Cancel Task
                  </button>
                )}

                {isAdminUser && (
                  <button
                    onClick={handleDeleteTask}
                    className="w-full py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors shadow-xs"
                  >
                    Delete Task
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Audit Info */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-6 space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Audit Info</h3>
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex justify-between">
                <span className="text-gray-400">Created:</span>
                <span className="font-medium text-gray-800">{new Date(task.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Created By:</span>
                <span className="font-medium text-gray-800">{task.createdBy.firstName} {task.createdBy.lastName}</span>
              </div>
              {task.completedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Completed:</span>
                  <span className="font-medium text-green-700">{new Date(task.completedAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
