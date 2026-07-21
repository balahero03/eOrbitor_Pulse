'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRequireRole } from '@/lib/hooks/useRequireRole';
import { AnnouncementIcon, ClipboardIcon, CloseIcon } from '@/components/icons';
import { useNotificationHighlight } from '@/lib/hooks/useNotificationHighlight';
import { highlightRingClass, requestHighlight } from '@/lib/notificationHighlight';
import LiveSearchDropdown, { highlightMatch } from '@/components/LiveSearchDropdown';

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: string;
  isPublished: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  createdBy: { id: string; firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

export default function AnnouncementsPage() {
  useRequireRole(['SUPER_ADMIN', 'ADMIN']);
  const router = useRouter();
  // Deep-linked from the search dropdown (no detail route — rings the card).
  const flashAnnouncementId = useNotificationHighlight('announcement');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    title: '',
    content: '',
    priority: 'NORMAL',
    expiresAt: '',
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(u => {
        if (!['SUPER_ADMIN', 'ADMIN'].includes(u.role)) {
          router.push('/dashboard');
          return;
        }
        setCurrentUser(u);
        fetchAnnouncements();
      })
      .catch(() => router.push('/login'));
  }, [router]);

  const fetchAnnouncements = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/announcements?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAnnouncements(data.data || []);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ title: '', content: '', priority: 'NORMAL', expiresAt: '' });
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.content) {
      alert('Title and content are required');
      return;
    }

    setSaving(true);
    const token = localStorage.getItem('token');
    try {
      const url = editingId
        ? `/api/announcements/${editingId}`
        : '/api/announcements';
      const method = editingId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save announcement');
      }

      setShowModal(false);
      resetForm();
      fetchAnnouncements();
      alert(editingId ? 'Announcement updated' : 'Announcement created');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (id: string, isPublished: boolean) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/announcements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isPublished: !isPublished }),
      });

      if (!res.ok) throw new Error('Failed to update announcement');
      fetchAnnouncements();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;

    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/announcements/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to delete announcement');
      fetchAnnouncements();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleEdit = (ann: Announcement) => {
    setForm({
      title: ann.title,
      content: ann.content,
      priority: ann.priority,
      expiresAt: ann.expiresAt ? ann.expiresAt.split('T')[0] : '',
    });
    setEditingId(ann.id);
    setShowModal(true);
  };

  const fetchAnnouncementSuggestions = useCallback(async (query: string): Promise<Announcement[]> => {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({ search: query, page: '1', limit: '8' });
    const res = await fetch(`/api/announcements?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Search failed');
    const data = await res.json();
    return (data.data || []) as Announcement[];
  }, []);

  const renderAnnouncementSuggestion = (ann: Announcement, query: string) => (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-900 truncate">{highlightMatch(ann.title, query)}</span>
        <span className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
          ann.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'
        }`}>
          {ann.isPublished ? 'Published' : 'Draft'}
        </span>
      </div>
      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{highlightMatch(ann.content, query)}</p>
    </div>
  );

  // No detail route for announcements — ring the matching card in place.
  const selectAnnouncementSuggestion = (ann: Announcement) => {
    setSearch(ann.title);
    requestHighlight('announcement', ann.id);
  };

  const displayAnnouncements = (() => {
    const q = search.trim().toLowerCase();
    if (!q) return announcements;
    return announcements.filter(a => a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q));
  })();

  if (loading) return <div className="p-6 text-center">Loading...</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
          <p className="text-sm text-gray-500 mt-0.5">{announcements.length} announcements</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 flex items-center gap-2"
        >
          <span className="text-lg">+</span> Create Announcement
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6 max-w-md">
        <LiveSearchDropdown<Announcement>
          value={search}
          onChange={setSearch}
          onSearch={() => {}}
          onSelect={selectAnnouncementSuggestion}
          fetchSuggestions={fetchAnnouncementSuggestions}
          getKey={(a) => a.id}
          getHref={() => '/announcements'}
          renderItem={renderAnnouncementSuggestion}
          placeholder="Search title or content..."
          ariaLabel="Search announcements"
          cacheKeyPrefix="announcements"
        />
      </div>

      <div className="space-y-4">
        {displayAnnouncements.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {search.trim() ? `No announcements match "${search.trim()}".` : 'No announcements yet. Create one to get started.'}
          </div>
        ) : (
          displayAnnouncements.map(ann => (
            <div
              key={ann.id}
              id={`announcement-${ann.id}`}
              className={`card p-5 border-l-4 ${highlightRingClass(flashAnnouncementId === ann.id)} ${ann.priority === 'URGENT'
                  ? 'border-l-red-500 bg-red-50'
                  : ann.priority === 'NORMAL'
                    ? 'border-l-blue-500 bg-blue-50'
                    : 'border-l-gray-500 bg-gray-50'
                }`}
            >
              <div className="flex items-start justify-between mb-2 gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold text-gray-900">{ann.title}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    By {ann.createdBy.firstName} {ann.createdBy.lastName}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${ann.isPublished
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-200 text-gray-700'
                      }`}
                  >
                    {ann.isPublished
                      ? <span className="inline-flex items-center gap-1"><AnnouncementIcon className="w-3 h-3" color="text-green-600" /> Published</span>
                      : <span className="inline-flex items-center gap-1"><ClipboardIcon className="w-3 h-3" /> Draft</span>}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${ann.priority === 'URGENT'
                        ? 'bg-red-100 text-red-700'
                        : ann.priority === 'NORMAL'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                  >
                    {ann.priority}
                  </span>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-4 leading-relaxed">{ann.content}</p>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <div>
                  {ann.publishedAt && (
                    <p>
                      Published: {new Date(ann.publishedAt).toLocaleDateString('en-IN')}
                    </p>
                  )}
                  {ann.expiresAt && (
                    <p>
                      Expires: {new Date(ann.expiresAt).toLocaleDateString('en-IN')}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePublish(ann.id, ann.isPublished)}
                    className={`px-3 py-1 rounded border text-xs ${ann.isPublished
                        ? 'border-yellow-200 text-yellow-600 hover:bg-yellow-50'
                        : 'border-green-200 text-green-600 hover:bg-green-50'
                      }`}
                  >
                    {ann.isPublished ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    onClick={() => handleEdit(ann)}
                    className="px-3 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50 text-xs"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(ann.id)}
                    className="px-3 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 text-xs"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-lg font-bold">
                {editingId ? 'Edit Announcement' : 'Create Announcement'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Title *
                </label>
                <input
                  required
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g., System Maintenance Scheduled"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Content *
                </label>
                <textarea
                  required
                  value={form.content}
                  onChange={e => setForm({ ...form, content: e.target.value })}
                  placeholder="Enter announcement content..."
                  rows={5}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Priority
                  </label>
                  <select
                    value={form.priority}
                    onChange={e => setForm({ ...form, priority: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Expires At
                  </label>
                  <input
                    type="date"
                    value={form.expiresAt}
                    onChange={e => setForm({ ...form, expiresAt: e.target.value })}
                    min={new Date().toLocaleDateString('en-CA')}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mt-6">
        <Link href="/dashboard" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
