'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  department?: string;
  isActive: boolean;
  manager?: { firstName: string; lastName: string };
  createdAt: string;
}

const ROLE_OPTIONS = [
  { value: 'ADMIN',         label: 'Admin',       desc: 'Full access to everything' },
  { value: 'SALES_MANAGER', label: 'Manager',     desc: 'Sees team leads & reports' },
  { value: 'SALES_EXEC',    label: 'Salesperson', desc: 'Sees own leads only' },
  { value: 'SUPPORT',       label: 'Support',     desc: 'Support tickets access' },
];

const ROLE_COLORS: Record<string, string> = {
  ADMIN:         'bg-red-100 text-red-700 border-red-200',
  SALES_MANAGER: 'bg-blue-100 text-blue-700 border-blue-200',
  SALES_EXEC:    'bg-green-100 text-green-700 border-green-200',
  SUPPORT:       'bg-yellow-100 text-yellow-700 border-yellow-200',
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin', SALES_MANAGER: 'Manager', SALES_EXEC: 'Salesperson', SUPPORT: 'Support',
};

const DEPT_OPTIONS = ['Sales', 'Management', 'Support', 'Operations', 'Finance', 'Other'];

type ModalMode = 'add' | 'edit' | 'password';

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Modal state
  const [modal, setModal] = useState<ModalMode | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Add / Edit form
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '',
    password: 'eOrbitor@2024',
    role: 'SALES_EXEC', department: 'Sales', managerId: '',
  });

  // Password change form
  const [pwForm, setPwForm] = useState({ newPassword: '', confirmPassword: '' });
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(u => {
        if (u.role !== 'ADMIN') { router.push('/dashboard'); return; }
        setCurrentUser(u);
        fetchUsers();
      })
      .catch(() => router.push('/login'));
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/users?limit=100', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const all: User[] = data.users || [];
      setUsers(all);
      setManagers(all.filter(u => u.role === 'SALES_MANAGER' || u.role === 'ADMIN'));
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setSelectedUser(null);
    setForm({ firstName: '', lastName: '', email: '', password: 'eOrbitor@2024', role: 'SALES_EXEC', department: 'Sales', managerId: '' });
    setError('');
    setModal('add');
  };

  const openEdit = (u: User) => {
    setSelectedUser(u);
    setForm({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      password: '',
      role: u.role,
      department: u.department || 'Sales',
      managerId: '',
    });
    setError('');
    setModal('edit');
  };

  const openPassword = (u: User) => {
    setSelectedUser(u);
    setPwForm({ newPassword: '', confirmPassword: '' });
    setShowPw(false);
    setError('');
    setModal('password');
  };

  const closeModal = () => { setModal(null); setSelectedUser(null); setError(''); };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create user');
      closeModal();
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSaving(true); setError('');
    const token = localStorage.getItem('token');
    try {
      const body: any = {
        firstName: form.firstName,
        lastName: form.lastName,
        role: form.role,
        department: form.department,
      };
      if (form.managerId) body.managerId = form.managerId;
      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user');
      closeModal();
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (pwForm.newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setSaving(true); setError('');
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: pwForm.newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');
      closeModal();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (u: User) => {
    if (u.id === currentUser?.id) { alert("You can't deactivate your own account."); return; }
    const token = localStorage.getItem('token');
    await fetch(`/api/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isActive: !u.isActive }),
    });
    setUsers(users.map(x => x.id === u.id ? { ...x, isActive: !x.isActive } : x));
  };

  const groups = [
    { label: 'Admins',       icon: '🔑', role: 'ADMIN' },
    { label: 'Managers',     icon: '👔', role: 'SALES_MANAGER' },
    { label: 'Salespersons', icon: '🧑‍💼', role: 'SALES_EXEC' },
    { label: 'Support',      icon: '🆘', role: 'SUPPORT' },
  ];

  const totalActive = users.filter(u => u.isActive).length;

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">{users.length} total · {totalActive} active</p>
        </div>
        <button onClick={openAdd} className="btn btn-primary flex items-center gap-2">
          <span className="text-lg">+</span> Add User
        </button>
      </div>

      {loading ? (
        <div className="p-10 text-center text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ label, icon, role }) => {
            const list = users.filter(u => u.role === role);
            if (list.length === 0) return null;
            return (
              <div key={role}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{icon}</span>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{label}</h2>
                  <span className="text-xs text-gray-400">({list.length})</span>
                </div>
                <div className="card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">Name</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">Email</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">Role</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">Department</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">Reports To</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {list.map(u => (
                        <tr key={u.id} className={`hover:bg-gray-50 ${!u.isActive ? 'opacity-50' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                                u.role === 'ADMIN' ? 'bg-red-500' :
                                u.role === 'SALES_MANAGER' ? 'bg-blue-500' : 'bg-green-500'
                              }`}>
                                {u.firstName.charAt(0)}{(u.lastName || '').charAt(0)}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{u.firstName} {u.lastName}</p>
                                {u.id === currentUser?.id && <p className="text-xs text-blue-500">You</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{u.email}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}>
                              {ROLE_LABELS[u.role] || u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{u.department || '—'}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {u.manager ? `${u.manager.firstName} ${u.manager.lastName}` : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {u.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openEdit(u)}
                                className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-100"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => openPassword(u)}
                                className="px-2 py-1 text-xs rounded border border-blue-200 text-blue-600 hover:bg-blue-50"
                              >
                                Password
                              </button>
                              <button
                                onClick={() => handleToggleActive(u)}
                                disabled={u.id === currentUser?.id}
                                className={`px-2 py-1 text-xs rounded border disabled:opacity-30 ${
                                  u.isActive
                                    ? 'border-red-200 text-red-600 hover:bg-red-50'
                                    : 'border-green-200 text-green-600 hover:bg-green-50'
                                }`}
                              >
                                {u.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── ADD USER MODAL ── */}
      {modal === 'add' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold">Add New User</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">First Name *</label>
                  <input required value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="e.g. Hema Priya" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Last Name</label>
                  <input value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="e.g. B" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email *</label>
                <input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="user@eorbitor.com" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Initial Password *</label>
                <input value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="eOrbitor@2024" />
                <p className="text-xs text-gray-400 mt-1">User should change this after first login</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Role *</label>
                  <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                    {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">{ROLE_OPTIONS.find(r => r.value === form.role)?.desc}</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Department</label>
                  <select value={form.department} onChange={e => setForm({...form, department: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                    {DEPT_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              {form.role === 'SALES_EXEC' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Reports To (Manager)</label>
                  <select value={form.managerId} onChange={e => setForm({...form, managerId: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                    <option value="">— No Manager —</option>
                    {managers.map(m => <option key={m.id} value={m.id}>{m.firstName} {m.lastName} ({ROLE_LABELS[m.role]})</option>)}
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-2 border-t">
                <button type="button" onClick={closeModal} className="btn btn-secondary flex-1" disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-1" disabled={saving}>
                  {saving ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT USER MODAL ── */}
      {modal === 'edit' && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Edit User</h2>
                <p className="text-sm text-gray-500">{selectedUser.email}</p>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleEdit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">First Name *</label>
                  <input required value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Last Name</label>
                  <input value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Role *</label>
                  <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    disabled={selectedUser.id === currentUser?.id}>
                    {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  {selectedUser.id === currentUser?.id && <p className="text-xs text-gray-400 mt-1">Cannot change your own role</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Department</label>
                  <select value={form.department} onChange={e => setForm({...form, department: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                    {DEPT_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              {form.role === 'SALES_EXEC' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Reports To (Manager)</label>
                  <select value={form.managerId} onChange={e => setForm({...form, managerId: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                    <option value="">— Keep current —</option>
                    {managers.filter(m => m.id !== selectedUser.id).map(m => (
                      <option key={m.id} value={m.id}>{m.firstName} {m.lastName} ({ROLE_LABELS[m.role]})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-2 border-t">
                <button type="button" onClick={closeModal} className="btn btn-secondary flex-1" disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-1" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CHANGE PASSWORD MODAL ── */}
      {modal === 'password' && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Change Password</h2>
                <p className="text-sm text-gray-500">{selectedUser.firstName} {selectedUser.lastName}</p>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={handlePasswordChange} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">New Password *</label>
                <div className="relative">
                  <input
                    required
                    type={showPw ? 'text' : 'password'}
                    value={pwForm.newPassword}
                    onChange={e => setPwForm({...pwForm, newPassword: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    placeholder="Min. 6 characters"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-2 text-gray-400 hover:text-gray-600 text-xs">
                    {showPw ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Confirm Password *</label>
                <input
                  required
                  type={showPw ? 'text' : 'password'}
                  value={pwForm.confirmPassword}
                  onChange={e => setPwForm({...pwForm, confirmPassword: e.target.value})}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 ${
                    pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword ? 'border-red-300' : ''
                  }`}
                  placeholder="Re-enter password"
                />
                {pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                )}
              </div>

              <div className="flex gap-3 pt-2 border-t">
                <button type="button" onClick={closeModal} className="btn btn-secondary flex-1" disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary flex-1" disabled={saving || pwForm.newPassword !== pwForm.confirmPassword}>
                  {saving ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
