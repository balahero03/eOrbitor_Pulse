'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

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
      case 'TODO': return 'bg-gray-100 text-gray-800';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'LOW': return 'bg-blue-50 text-blue-700';
      case 'MEDIUM': return 'bg-yellow-50 text-yellow-700';
      case 'HIGH': return 'bg-orange-50 text-orange-700';
      case 'URGENT': return 'bg-red-50 text-red-700';
      default: return 'bg-gray-50 text-gray-700';
    }
  };

  const isOverdue = () => {
    if (!task?.dueDate || task.status === 'COMPLETED') return false;
    return new Date(task.dueDate) < new Date();
  };

  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (!task) return <div className="p-6 text-center">Task not found</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">{task.title}</h1>
        <Link href="/tasks" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Back to Tasks</Link>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-4">
          {/* Status Info */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-4 mb-4">
              <span className={`badge px-3 py-1 rounded font-medium ${getStatusColor(task.status)}`}>
                {task.status.replace('_', ' ')}
              </span>
              <span className={`badge px-3 py-1 rounded font-medium ${getPriorityColor(task.priority)}`}>
                {task.priority}
              </span>
            </div>

            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 mb-4"
              >
                Edit
              </button>
            )}

            {editing ? (
              <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full h-24"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
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
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
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
                  <label className="block text-sm font-medium mb-1">Due Date</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Tags (comma separated)</label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="urgent, follow-up, important"
                    className="w-full"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                {task.description && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Description</p>
                    <p className="text-gray-700">{task.description}</p>
                  </div>
                )}

                {task.dueDate && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Due Date</p>
                    <p className={isOverdue() ? 'text-red-600 font-bold' : 'text-gray-700'}>
                      {new Date(task.dueDate).toLocaleDateString()}
                      {isOverdue() && ' (OVERDUE)'}
                    </p>
                  </div>
                )}

                {task.tags && task.tags.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Tags</p>
                    <div className="flex flex-wrap gap-2">
                      {task.tags.map(tag => (
                        <span key={tag} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Assignment */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-3">Assignment</h3>
            <div className="space-y-2 text-sm">
              {task.assignedTo ? (
                <>
                  <p>
                    <span className="text-gray-500">Assigned to:</span>
                    <br />
                    <span className="font-medium">{task.assignedTo.firstName} {task.assignedTo.lastName}</span>
                  </p>
                  <p>
                    <span className="text-gray-500">Email:</span>
                    <br />
                    <span className="font-medium">{task.assignedTo.email}</span>
                  </p>
                </>
              ) : (
                <p className="text-gray-400 italic">Unassigned</p>
              )}
            </div>
          </div>

          {/* Deal Link */}
          {task.relatedDeal && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-3">Related Deal</h3>
              <p className="text-sm font-medium">{task.relatedDeal.dealName}</p>
            </div>
          )}

          {/* Actions */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-3">Actions</h3>
            <div className="space-y-2">
              {task.status !== 'COMPLETED' && (
                <button
                  onClick={handleCompleteTask}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  Mark Complete
                </button>
              )}

              <button
                onClick={handleDeleteTask}
                className="w-full py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700"
              >
                Delete Task
              </button>
            </div>
          </div>

          {/* Meta */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Details</h3>
            <div className="space-y-2 text-xs text-gray-600">
              <p>
                <span className="font-medium">Created:</span>
                <br />
                {new Date(task.createdAt).toLocaleDateString()}
              </p>
              <p>
                <span className="font-medium">By:</span>
                <br />
                {task.createdBy.firstName} {task.createdBy.lastName}
              </p>
              {task.completedAt && (
                <p>
                  <span className="font-medium">Completed:</span>
                  <br />
                  {new Date(task.completedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
