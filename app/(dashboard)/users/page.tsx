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
  managerId?: string;
  manager?: { id: string; firstName: string; lastName: string };
  createdAt: string;
}

const ROLE_OPTIONS = [
  { value: 'SUPER_ADMIN',   label: 'Super Admin', desc: 'Unrestricted access — system owner' },
  { value: 'ADMIN',         label: 'Admin',       desc: 'Full access to everything' },
  { value: 'SALES_MANAGER', label: 'Manager',     desc: 'Sees team leads & team activity' },
  { value: 'SALES_EXEC',    label: 'Salesperson', desc: 'Sees own leads only' },
  { value: 'SUPPORT',       label: 'Support',     desc: 'Support staff' },
];

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN:   'bg-purple-100 text-purple-700 border-purple-200',
  ADMIN:         'bg-red-100 text-red-700 border-red-200',
  SALES_MANAGER: 'bg-blue-100 text-blue-700 border-blue-200',
  SALES_EXEC:    'bg-green-100 text-green-700 border-green-200',
  SUPPORT:       'bg-yellow-100 text-yellow-700 border-yellow-200',
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', ADMIN: 'Admin', SALES_MANAGER: 'Manager', SALES_EXEC: 'Salesperson', SUPPORT: 'Support',
};

const DEPT_OPTIONS = ['Sales', 'Management', 'Support', 'Operations', 'Finance', 'Other'];

type ModalMode = 'add' | 'edit' | 'password' | 'assign-manager' | 'team-view';

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

  // Assign-manager form
  const [assignManagerId, setAssignManagerId] = useState<string>('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(u => {
        if (!['SUPER_ADMIN','ADMIN'].includes(u.role) && u.role !== 'SUPPORT') { router.push('/dashboard'); return; }
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
      managerId: u.manager?.id || '',
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

  const openAssignManager = (u: User) => {
    setSelectedUser(u);
    setAssignManagerId(u.manager?.id || '');
    setError('');
    setModal('assign-manager');
  };

  const closeModal = () => { setModal(null); setSelectedUser(null); setError(''); };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    const token = localStorage.getItem('token');
    try {
      const body: any = { ...form };
      if (!body.managerId) delete body.managerId;
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
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
        managerId: form.managerId || null,
      };
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

  const handleAssignManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSaving(true); setError('');
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ managerId: assignManagerId || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign manager');
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
    { label: 'Super Admins', icon: '👑', role: 'SUPER_ADMIN' },
    { label: 'Admins',       icon: '🔑', role: 'ADMIN' },
    { label: 'Managers',     icon: '👔', role: 'SALES_MANAGER' },
    { label: 'Salespersons', icon: '🧑‍💼', role: 'SALES_EXEC' },
    { label: 'Support',      icon: '🆘', role: 'SUPPORT' },
  ];

  const totalActive = users.filter(u => u.isActive).length;

  // Build manager → exec map for team view
  const teamMap = managers.map(mgr => ({
    manager: mgr,
    execs: users.filter(u => u.role === 'SALES_EXEC' && u.manager?.id === mgr.id),
  }));
  const unassignedExecs = users.filter(u => u.role === 'SALES_EXEC' && !u.manager);

  const canEdit = currentUser && ['SUPER_ADMIN', 'ADMIN'].includes(currentUser.role);

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">{users.length} total · {totalActive} active</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModal('team-view')}
            className="px-4 py-2 text-sm rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 font-medium"
          >
            Team Structure
          </button>
          {canEdit && (
            <button onClick={openAdd} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 flex items-center gap-2">
              <span className="text-lg">+</span> Add User
            </button>
          )}
        </div>
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
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
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
                                u.role === 'SUPER_ADMIN' ? 'bg-purple-600' :
                                u.role === 'ADMIN' ? 'bg-red-500' :
                                u.role === 'SALES_MANAGER' ? 'bg-blue-500' :
                                u.role === 'SUPPORT' ? 'bg-yellow-500' : 'bg-green-500'
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
                            {u.manager ? (
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                                {u.manager.firstName} {u.manager.lastName}
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {u.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 flex-wrap">
                              {canEdit && (
                                <button
                                  onClick={() => openEdit(u)}
                                  className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-100"
                                >
                                  Edit
                                </button>
                              )}
                              {canEdit && u.role === 'SALES_EXEC' && (
                                <button
                                  onClick={() => openAssignManager(u)}
                                  className="px-2 py-1 text-xs rounded border border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                                >
                                  Assign Manager
                                </button>
                              )}
                              {canEdit && (
                                <button
                                  onClick={() => openPassword(u)}
                                  className="px-2 py-1 text-xs rounded border border-blue-200 text-blue-600 hover:bg-blue-50"
                                >
                                  Password
                                </button>
                              )}
                              {canEdit && (
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
                              )}
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

      {/* ── TEAM STRUCTURE MODAL ── */}
      {modal === 'team-view' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold">Team Structure</h2>
                <p className="text-sm text-gray-500">Manager → Salesperson relationships</p>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="overflow-y-auto p-6 space-y-4">
              {teamMap.map(({ manager: mgr, execs }) => (
                <div key={mgr.id} className="border rounded-lg overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border-b">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                      {mgr.firstName.charAt(0)}{(mgr.lastName || '').charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 text-sm">{mgr.firstName} {mgr.lastName}</p>
                      <p className="text-xs text-gray-500">{mgr.email}</p>
                    </div>
                    <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full font-medium">
                      {ROLE_LABELS[mgr.role]}
                    </span>
                    <span className="text-xs text-gray-400">{execs.length} exec{execs.length !== 1 ? 's' : ''}</span>
                  </div>
                  {execs.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-gray-400 italic">No salespersons assigned</div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {execs.map(exec => (
                        <div key={exec.id} className="flex items-center gap-3 px-4 py-2.5 pl-10">
                          <div className="w-1 h-4 border-l-2 border-gray-200 mr-1" />
                          <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">
                            {exec.firstName.charAt(0)}{(exec.lastName || '').charAt(0)}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-800">{exec.firstName} {exec.lastName}</p>
                            <p className="text-xs text-gray-400">{exec.email}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${exec.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                            {exec.isActive ? 'Active' : 'Inactive'}
                          </span>
                          {canEdit && (
                            <button
                              onClick={() => { closeModal(); openAssignManager(exec); }}
                              className="text-xs text-indigo-500 hover:text-indigo-700 hover:underline"
                            >
                              Reassign
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {unassignedExecs.length > 0 && (
                <div className="border border-dashed border-gray-300 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b">
                    <span className="text-gray-400 text-sm font-semibold">Unassigned Salespersons</span>
                    <span className="text-xs text-gray-400">({unassignedExecs.length})</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {unassignedExecs.map(exec => (
                      <div key={exec.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="w-7 h-7 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-bold">
                          {exec.firstName.charAt(0)}{(exec.lastName || '').charAt(0)}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-700">{exec.firstName} {exec.lastName}</p>
                          <p className="text-xs text-gray-400">{exec.email}</p>
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => { closeModal(); openAssignManager(exec); }}
                            className="text-xs text-indigo-500 hover:text-indigo-700 hover:underline"
                          >
                            Assign Manager
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ASSIGN MANAGER MODAL ── */}
      {modal === 'assign-manager' && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Assign Manager</h2>
                <p className="text-sm text-gray-500">{selectedUser.firstName} {selectedUser.lastName}</p>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleAssignManager} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

              {/* Current manager info */}
              <div className="p-3 rounded-lg bg-gray-50 border text-sm">
                <p className="text-xs font-semibold text-gray-500 mb-1">Current Manager</p>
                {selectedUser.manager ? (
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                      {selectedUser.manager.firstName.charAt(0)}{(selectedUser.manager.lastName || '').charAt(0)}
                    </div>
                    <span className="font-medium text-gray-800">
                      {selectedUser.manager.firstName} {selectedUser.manager.lastName}
                    </span>
                  </div>
                ) : (
                  <p className="text-gray-400 italic">No manager assigned</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Assign To</label>
                <select
                  value={assignManagerId}
                  onChange={e => setAssignManagerId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="">— No Manager (Unassign) —</option>
                  {managers
                    .filter(m => m.id !== selectedUser.id && m.isActive)
                    .map(m => (
                      <option key={m.id} value={m.id}>
                        {m.firstName} {m.lastName} · {ROLE_LABELS[m.role]}
                      </option>
                    ))}
                </select>
                {managers.filter(m => m.isActive).length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">No active managers or admins found. Create one first.</p>
                )}
              </div>

              <div className="flex gap-3 pt-2 border-t">
                <button type="button" onClick={closeModal} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50" disabled={saving}>Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Assignment'}
                </button>
              </div>
            </form>
          </div>
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
                  <select value={form.role} onChange={e => setForm({...form, role: e.target.value, managerId: ''})}
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
                    {managers.filter(m => m.isActive).map(m => (
                      <option key={m.id} value={m.id}>{m.firstName} {m.lastName} · {ROLE_LABELS[m.role]}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-2 border-t">
                <button type="button" onClick={closeModal} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50" disabled={saving}>Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50" disabled={saving}>
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
                  <select
                    value={form.role}
                    onChange={e => setForm({...form, role: e.target.value, managerId: ''})}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    disabled={selectedUser.id === currentUser?.id}
                  >
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
                  <select
                    value={form.managerId}
                    onChange={e => setForm({...form, managerId: e.target.value})}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="">— No Manager —</option>
                    {managers
                      .filter(m => m.id !== selectedUser.id && m.isActive)
                      .map(m => (
                        <option key={m.id} value={m.id}>{m.firstName} {m.lastName} · {ROLE_LABELS[m.role]}</option>
                      ))}
                  </select>
                  {form.managerId && (
                    <p className="text-xs text-gray-400 mt-1">
                      Currently: {managers.find(m => m.id === form.managerId)
                        ? `${managers.find(m => m.id === form.managerId)!.firstName} ${managers.find(m => m.id === form.managerId)!.lastName}`
                        : selectedUser.manager
                          ? `${selectedUser.manager.firstName} ${selectedUser.manager.lastName}`
                          : 'None'}
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2 border-t">
                <button type="button" onClick={closeModal} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50" disabled={saving}>Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50" disabled={saving}>
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
                <button type="button" onClick={closeModal} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50" disabled={saving}>Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50" disabled={saving || pwForm.newPassword !== pwForm.confirmPassword}>
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
