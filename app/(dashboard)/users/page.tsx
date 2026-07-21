'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { StarIconC, KeyIcon2, BriefcaseIcon2, UsersMultiIcon, BlockedIcon, CloseIcon } from '@/components/icons';
import { canManageUser, roleRank } from '@/lib/roles';
import { useNotificationHighlight } from '@/lib/hooks/useNotificationHighlight';
import { highlightRowClass, requestHighlight } from '@/lib/notificationHighlight';
import LiveSearchDropdown, { highlightMatch } from '@/components/LiveSearchDropdown';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  department?: string;
  phone?: string;
  employeeId?: string;
  jobTitle?: string;
  assignedTerritory?: string;
  isActive: boolean;
  deletedAt?: string | null;
  managerId?: string;
  manager?: { id: string; firstName: string; lastName: string };
  createdAt: string;
}

const ROLE_OPTIONS = [
  { value: 'SUPER_ADMIN', label: 'Super Admin', desc: 'Unrestricted access — system owner' },
  { value: 'ADMIN', label: 'Admin', desc: 'Full access to everything' },
  { value: 'BACKEND_TEAM', label: 'Backend Team', desc: 'Sees team leads & team activity' },
  { value: 'ON_FIELD_TEAM', label: 'On Field Team', desc: 'Sees own leads only' },
];

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700 border-purple-200',
  ADMIN: 'bg-red-100 text-red-700 border-red-200',
  BACKEND_TEAM: 'bg-blue-100 text-blue-700 border-blue-200',
  ON_FIELD_TEAM: 'bg-green-100 text-green-700 border-green-200',
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', ADMIN: 'Admin', BACKEND_TEAM: 'Backend Team', ON_FIELD_TEAM: 'On Field Team',
};

const DEPT_OPTIONS = ['Sales', 'Management', 'Support', 'Operations', 'Finance', 'Other'];

type ModalMode = 'add' | 'edit' | 'password' | 'assign-manager' | 'team-view' | 'ex-records' | 'role-switch';

// Role-switch modal state
interface RoleSwitchState {
  user: User;
  newRole: string;
  // Ownership preview
  leadsAssigned: number;
  broughtLeads: number;
  deals: number;
  tasks: number;
  subordinates: Array<{ id: string; firstName: string; lastName: string }>;
  // Admin decisions
  leadsAction: 'keep' | 'transfer';
  leadsTargetUserId: string;
  broughtLeadsAction: 'keep' | 'transfer';
  broughtLeadsTargetUserId: string;
  dealsAction: 'keep' | 'transfer';
  dealsTargetUserId: string;
  tasksAction: 'keep' | 'transfer';
  tasksTargetUserId: string;
  // subordinateId -> newManagerId
  subordinateManagerMap: Record<string, string>;
  step: 'preview' | 'confirm';
  loading: boolean;
}

interface RecordRow { key: string; label: string; count: number; }
interface RecordBreakdown {
  business: RecordRow[];
  personal: RecordRow[];
  businessTotal: number;
  personalTotal: number;
  canHardDelete: boolean;
}

function UserActionMenu({
  user,
  currentUser,
  canEdit,
  canManageTarget,
  isSelf,
  isOpen,
  onOpenToggle,
  onEdit,
  onAssignManager,
  onSwitchRole,
  onPassword,
  onToggleActive,
  onDelete,
}: {
  user: User;
  currentUser: any;
  canEdit: boolean;
  canManageTarget: (u: User) => boolean;
  isSelf: (u: User) => boolean;
  isOpen: boolean;
  onOpenToggle: (open: boolean) => void;
  onEdit: () => void;
  onAssignManager: () => void;
  onSwitchRole: () => void;
  onPassword: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOpenToggle(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const hasEdit = canEdit && (canManageTarget(user) || isSelf(user));
  const hasAssignMgr = canEdit && canManageTarget(user) && user.role === 'ON_FIELD_TEAM';
  const hasSwitchRole = canEdit && canManageTarget(user) && (user.role === 'BACKEND_TEAM' || user.role === 'ON_FIELD_TEAM');
  const hasPassword = canEdit && (canManageTarget(user) || isSelf(user));
  const hasToggleActive = canEdit && canManageTarget(user);
  const hasDelete = canEdit && canManageTarget(user);

  if (!hasEdit && !hasAssignMgr && !hasSwitchRole && !hasPassword && !hasToggleActive && !hasDelete) {
    return <span className="text-gray-300">—</span>;
  }

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onOpenToggle(!isOpen);
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:text-gray-900 hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm focus:outline-none"
        title="Manage User"
      >
        <span>Manage</span>
        <svg className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1.5 text-left">
          {hasEdit && (
            <button
              onClick={() => { onEdit(); onOpenToggle(false); }}
              className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit Details
            </button>
          )}
          
          {hasAssignMgr && (
            <button
              onClick={() => { onAssignManager(); onOpenToggle(false); }}
              className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Assign Manager
            </button>
          )}

          {hasSwitchRole && (
            <button
              onClick={() => { onSwitchRole(); onOpenToggle(false); }}
              className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Switch Role
            </button>
          )}

          {hasPassword && (
            <button
              onClick={() => { onPassword(); onOpenToggle(false); }}
              className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <KeyIcon2 className="w-3.5 h-3.5 text-gray-400" />
              Change Password
            </button>
          )}

          {(hasToggleActive || hasDelete) && <div className="border-t border-gray-100 my-1" />}

          {hasToggleActive && (
            <button
              onClick={() => { onToggleActive(); onOpenToggle(false); }}
              className={`w-full text-left px-4 py-2 text-xs flex items-center gap-2 ${
                user.isActive ? 'text-amber-600 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              {user.isActive ? 'Deactivate User' : 'Activate User'}
            </button>
          )}

          {hasDelete && (
            <button
              onClick={() => { onDelete(); onOpenToggle(false); }}
              className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium"
            >
              <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete User
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function UsersPage() {
  // Deep-linked from a user-inactive notification — rings the matching row.
  const flashUserId = useNotificationHighlight('user');
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [exEmployees, setExEmployees] = useState<User[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeMenuUserId, setActiveMenuUserId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Modal state
  const [modal, setModal] = useState<ModalMode | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Add / Edit form
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '',
    password: 'eOrbitor@2024',
    role: 'ON_FIELD_TEAM', department: 'Sales', managerId: '',
    phone: '', employeeId: '', jobTitle: '', assignedTerritory: '',
  });

  // Password change form
  const [pwForm, setPwForm] = useState({ newPassword: '', confirmPassword: '' });
  const [showPw, setShowPw] = useState(false);

  // Assign-manager form
  const [assignManagerId, setAssignManagerId] = useState<string>('');

  // Ex-employee records / reassign state
  const [records, setRecords] = useState<RecordBreakdown | null>(null);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [reassignTargetId, setReassignTargetId] = useState<string>('');

  // Role-switch modal state
  const [roleSwitchState, setRoleSwitchState] = useState<RoleSwitchState | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(u => {
        if (!['SUPER_ADMIN', 'ADMIN'].includes(u.role)) { router.push('/dashboard'); return; }
        setCurrentUser(u);
        fetchUsers();
      })
      .catch(() => router.push('/login'));
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const [activeRes, exRes] = await Promise.all([
        fetch('/api/users?limit=100', { headers }),
        fetch('/api/users?status=ex&limit=100', { headers }),
      ]);
      const data = await activeRes.json();
      const all: User[] = data.users || [];
      setUsers(all);
      setManagers(all.filter(u => u.role === 'BACKEND_TEAM' || u.role === 'ADMIN'));
      if (exRes.ok) {
        const exData = await exRes.json();
        setExEmployees(exData.users || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchUserSuggestions = useCallback(async (query: string): Promise<User[]> => {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({ search: query, page: '1', limit: '8' });
    const res = await fetch(`/api/users?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Search failed');
    const data = await res.json();
    return (data.users || []) as User[];
  }, []);

  const renderUserSuggestion = (u: User, query: string) => (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-900 truncate">{highlightMatch(`${u.firstName} ${u.lastName}`, query)}</span>
        <span className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
          {ROLE_LABELS[u.role] || u.role}
        </span>
        {!u.isActive && (
          <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Inactive</span>
        )}
      </div>
      <p className="text-xs text-gray-500 mt-0.5 truncate">{highlightMatch(u.email, query)}</p>
    </div>
  );

  // Users has no dedicated detail route — "opening" a result means ringing
  // the matching row in the table already on screen (same mechanism the
  // "user inactive" notification uses to point at a specific row).
  const selectUserSuggestion = (u: User) => {
    setSearch(`${u.firstName} ${u.lastName}`);
    requestHighlight('user', u.id);
  };

  const openAdd = () => {
    setSelectedUser(null);
    setForm({ firstName: '', lastName: '', email: '', password: 'eOrbitor@2024', role: 'ON_FIELD_TEAM', department: 'Sales', managerId: '', phone: '', employeeId: '', jobTitle: '', assignedTerritory: '' });
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
      phone: u.phone || '',
      employeeId: u.employeeId || '',
      jobTitle: u.jobTitle || '',
      assignedTerritory: u.assignedTerritory || '',
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

  const closeModal = () => { setModal(null); setSelectedUser(null); setError(''); setRecords(null); setReassignTargetId(''); setRoleSwitchState(null); };

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

    // Check if the role is being changed and ask for confirmation
    if (form.role !== selectedUser.role) {
      const oldRoleLabel = ROLE_LABELS[selectedUser.role] || selectedUser.role;
      const newRoleLabel = ROLE_LABELS[form.role] || form.role;
      let warningMsg = `Are you sure you want to change ${selectedUser.firstName}'s role from ${oldRoleLabel} to ${newRoleLabel}?`;

      if (selectedUser.role === 'BACKEND_TEAM' && form.role === 'ON_FIELD_TEAM') {
        warningMsg += `\n\nWARNING: Since they are being demoted to On Field Team, any team members reporting to them will be unassigned (their manager will be set to None).`;
      }

      if (!confirm(warningMsg)) return;
    }

    setSaving(true); setError('');
    const token = localStorage.getItem('token');
    try {
      const body: any = {
        firstName: form.firstName,
        lastName: form.lastName,
        role: form.role,
        department: form.department,
        managerId: form.managerId || null,
        phone: form.phone,
        employeeId: form.employeeId,
        jobTitle: form.jobTitle,
        assignedTerritory: form.assignedTerritory,
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

  const openRoleSwitchModal = async (u: User) => {
    const isBackend = u.role === 'BACKEND_TEAM';
    const newRole = isBackend ? 'ON_FIELD_TEAM' : 'BACKEND_TEAM';
    const token = localStorage.getItem('token');

    // Start with loading state
    const initialState: RoleSwitchState = {
      user: u,
      newRole,
      leadsAssigned: 0, broughtLeads: 0, deals: 0, tasks: 0, subordinates: [],
      leadsAction: 'keep', leadsTargetUserId: '',
      broughtLeadsAction: 'keep', broughtLeadsTargetUserId: '',
      dealsAction: 'keep', dealsTargetUserId: '',
      tasksAction: 'keep', tasksTargetUserId: '',
      subordinateManagerMap: {},
      step: 'preview',
      loading: true,
    };
    setRoleSwitchState(initialState);
    setModal('role-switch');

    try {
      // Fetch ownership summary and subordinates in parallel
      const [recordsRes, subRes] = await Promise.all([
        fetch(`/api/users/${u.id}/records`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/users?managerId=${u.id}&limit=100`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      let leadsAssigned = 0, broughtLeads = 0, deals = 0, tasks = 0;
      if (recordsRes.ok) {
        const rd = await recordsRes.json();
        const biz: Array<{ key: string; count: number }> = rd.business || [];
        leadsAssigned = biz.find(r => r.key === 'leadsAssigned')?.count ?? 0;
        broughtLeads = biz.find(r => r.key === 'leadsBrought')?.count ?? 0;
        deals = biz.find(r => r.key === 'deals')?.count ?? 0;
        const tasksCreated = biz.find(r => r.key === 'tasksCreated')?.count ?? 0;
        const tasksAssigned = biz.find(r => r.key === 'tasksAssigned')?.count ?? 0;
        tasks = tasksCreated + tasksAssigned;
      }

      let subordinatesList: Array<{ id: string; firstName: string; lastName: string }> = [];
      if (subRes.ok) {
        const sd = await subRes.json();
        subordinatesList = (sd.users || []).filter((su: User) => su.role === 'ON_FIELD_TEAM' && su.manager?.id === u.id);
      } else {
        // Fallback: filter from already-loaded users
        subordinatesList = users.filter(su => su.manager?.id === u.id && su.role === 'ON_FIELD_TEAM');
      }

      setRoleSwitchState(prev => prev ? ({
        ...prev,
        leadsAssigned, broughtLeads, deals, tasks,
        subordinates: subordinatesList,
        subordinateManagerMap: Object.fromEntries(subordinatesList.map(s => [s.id, ''])),
        loading: false,
      }) : prev);
    } catch {
      setRoleSwitchState(prev => prev ? { ...prev, loading: false } : prev);
    }
  };

  const handleRoleSwitchSubmit = async () => {
    if (!roleSwitchState) return;
    const { user: u, newRole, leadsAction, leadsTargetUserId, broughtLeadsAction, broughtLeadsTargetUserId,
      dealsAction, dealsTargetUserId, tasksAction, tasksTargetUserId, subordinateManagerMap, subordinates } = roleSwitchState;

    // Validate subordinates when demoting
    const isDemotion = newRole === 'ON_FIELD_TEAM';
    if (isDemotion && subordinates.length > 0) {
      const unassigned = subordinates.filter(s => !subordinateManagerMap[s.id]);
      if (unassigned.length > 0) {
        alert(`Please assign a new manager for: ${unassigned.map(s => s.firstName).join(', ')}`);
        return;
      }
    }

    setSaving(true);
    const token = localStorage.getItem('token');
    try {
      const subordinateReassignments = isDemotion
        ? subordinates.map(s => ({ subordinateId: s.id, newManagerId: subordinateManagerMap[s.id] || null }))
        : [];

      const res = await fetch(`/api/users/${u.id}/role-switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          newRole,
          leadsAction, leadsTargetUserId: leadsAction === 'transfer' ? leadsTargetUserId : undefined,
          broughtLeadsAction, broughtLeadsTargetUserId: broughtLeadsAction === 'transfer' ? broughtLeadsTargetUserId : undefined,
          dealsAction, dealsTargetUserId: dealsAction === 'transfer' ? dealsTargetUserId : undefined,
          tasksAction, tasksTargetUserId: tasksAction === 'transfer' ? tasksTargetUserId : undefined,
          subordinateReassignments,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to switch role');
      closeModal();
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
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

  const handleDelete = async (u: User) => {
    if (u.id === currentUser?.id) { alert("You can't delete your own account."); return; }
    if (!confirm(
      `Delete ${u.firstName} ${u.lastName}?\n\n` +
      `If they own no records they'll be permanently removed. ` +
      `If they own leads/deals/activity, they'll be marked as an ex-employee and their data preserved.`
    )) return;
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/users/${u.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Failed to delete user'); return; }
    alert(
      data.deleted === 'soft'
        ? `${u.firstName} was marked as an ex-employee (${data.recordCount} record(s) preserved).`
        : `${u.firstName} was permanently deleted.`
    );
    fetchUsers();
  };

  const handleRestore = async (u: User) => {
    if (!confirm(`Restore ${u.firstName} ${u.lastName} as an active user?`)) return;
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ restore: true }),
    });
    if (!res.ok) { const d = await res.json(); alert(d.error || 'Failed to restore'); return; }
    fetchUsers();
  };

  const handlePermanentRemove = async (u: User) => {
    if (!confirm(
      `Permanently remove ${u.firstName} ${u.lastName}? This cannot be undone.\n\n` +
      `Their business records must already be reassigned. Their personal logs ` +
      `(attendance, activity, time logs) will be deleted along with the account.`
    )) return;
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/users/${u.id}?hard=true`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Failed to remove user'); return; }
    closeModal();
    fetchUsers();
  };

  const fetchRecords = async (u: User) => {
    setRecordsLoading(true);
    setRecords(null);
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/users/${u.id}/records`, { headers: { Authorization: `Bearer ${token}` } });
    setRecordsLoading(false);
    if (!res.ok) { const d = await res.json(); alert(d.error || 'Failed to load records'); return; }
    setRecords(await res.json());
  };

  const openExRecords = (u: User) => {
    setSelectedUser(u);
    setReassignTargetId('');
    setRecords(null);
    setModal('ex-records');
    fetchRecords(u);
  };

  const handleReassign = async () => {
    if (!selectedUser || !reassignTargetId) return;
    setSaving(true);
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/users/${selectedUser.id}/reassign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ targetUserId: reassignTargetId }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { alert(data.error || 'Failed to reassign'); return; }
    alert(data.message);
    setReassignTargetId('');
    fetchRecords(selectedUser);
  };

  const groups = [
    { label: 'Super Admins', Icon: StarIconC, role: 'SUPER_ADMIN' },
    { label: 'Admins', Icon: KeyIcon2, role: 'ADMIN' },
    { label: 'Backend Team', Icon: BriefcaseIcon2, role: 'BACKEND_TEAM' },
    { label: 'On Field Team', Icon: UsersMultiIcon, role: 'ON_FIELD_TEAM' },
  ];

  // "View all results" / bare Enter on the search box narrows the tables
  // below to matching users — everything's already loaded client-side, so
  // this is a plain filter rather than a re-fetch.
  const displayUsers = (() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  })();

  const totalActive = users.filter(u => u.isActive).length;

  // Build manager → exec map for team view
  const teamMap = managers.map(mgr => ({
    manager: mgr,
    execs: users.filter(u => u.role === 'ON_FIELD_TEAM' && u.manager?.id === mgr.id),
  }));
  const unassignedExecs = users.filter(u => u.role === 'ON_FIELD_TEAM' && !u.manager);

  const canEdit = currentUser && ['SUPER_ADMIN', 'ADMIN'].includes(currentUser.role);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  // Whether the signed-in user outranks (and may therefore manage) the target.
  // Mirrors the server rule so we don't show actions that would 403.
  const canManageTarget = (u: User) => !!currentUser && canManageUser(currentUser.role, u.role);
  const isSelf = (u: User) => u.id === currentUser?.id;
  // Roles the signed-in user may assign — only those ranked below their own,
  // so an ADMIN can't grant ADMIN/SUPER_ADMIN. Matches the server guard.
  const assignableRoles = ROLE_OPTIONS.filter(r => !currentUser || roleRank(r.value) < roleRank(currentUser.role));
  // Active users available as reassignment targets (exclude the ex-employee being processed).
  const reassignTargets = users.filter(u => u.isActive && u.id !== selectedUser?.id);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
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

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6 max-w-md">
        <LiveSearchDropdown<User>
          value={search}
          onChange={setSearch}
          onSearch={() => {}}
          onSelect={selectUserSuggestion}
          fetchSuggestions={fetchUserSuggestions}
          getKey={(u) => u.id}
          getHref={() => '/users'}
          renderItem={renderUserSuggestion}
          placeholder="Search by name or email..."
          ariaLabel="Search users"
          cacheKeyPrefix="users"
        />
      </div>

      {loading ? (
        <div className="p-10 text-center text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ label, Icon, role }) => {
            const list = displayUsers.filter(u => u.role === role);
            if (list.length === 0) return null;
            return (
              <div key={role}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-5 h-5" />
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{label}</h2>
                  <span className="text-xs text-gray-400">({list.length})</span>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                  <table className="w-full table-fixed text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="w-[18%] px-4 py-3 text-left font-semibold text-gray-600">Name</th>
                        <th className="w-[22%] px-4 py-3 text-left font-semibold text-gray-600">Email</th>
                        <th className="w-[12%] px-4 py-3 text-left font-semibold text-gray-600">Role</th>
                        <th className="w-[10%] px-4 py-3 text-left font-semibold text-gray-600">Department</th>
                        <th className="w-[12%] px-4 py-3 text-left font-semibold text-gray-600">Reports To</th>
                        <th className="w-[8%] px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                        <th className="w-[18%] px-4 py-3 text-left font-semibold text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                       {list.map(u => {
                        const isMenuOpen = activeMenuUserId === u.id;
                        return (
                          <tr key={u.id} id={`user-${u.id}`} className={`transition-all duration-150 ${!u.isActive ? 'opacity-50' : ''} ${isMenuOpen ? 'bg-blue-50/50 hover:bg-blue-50 border-l-2 border-blue-500 shadow-sm' : 'hover:bg-gray-50'} ${highlightRowClass(flashUserId === u.id)}`}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${u.role === 'SUPER_ADMIN' ? 'bg-purple-600' :
                                  u.role === 'ADMIN' ? 'bg-red-500' :
                                    u.role === 'BACKEND_TEAM' ? 'bg-blue-500' : 'bg-green-500'
                                  }`}>
                                  {u.firstName.charAt(0)}{(u.lastName || '').charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-gray-900 truncate">{u.firstName} {u.lastName}</p>
                                  {u.id === currentUser?.id && <p className="text-xs text-blue-500">You</p>}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-600 truncate" title={u.email}>{u.email}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}>
                                {ROLE_LABELS[u.role] || u.role}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-xs">{u.department || '—'}</td>
                            <td className="px-4 py-3 text-gray-500 text-xs">
                              {u.manager ? (
                                <span className="flex items-center gap-1 min-w-0" title={`${u.manager.firstName} ${u.manager.lastName}`}>
                                  <span className="w-2 h-2 rounded-full bg-blue-400 inline-block flex-shrink-0" />
                                  <span className="truncate">{u.manager.firstName} {u.manager.lastName}</span>
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
                              <UserActionMenu
                                user={u}
                                currentUser={currentUser}
                                canEdit={canEdit}
                                canManageTarget={canManageTarget}
                                isSelf={isSelf}
                                isOpen={isMenuOpen}
                                onOpenToggle={(open) => setActiveMenuUserId(open ? u.id : null)}
                                onEdit={() => openEdit(u)}
                                onAssignManager={() => openAssignManager(u)}
                                  onSwitchRole={() => openRoleSwitchModal(u)}
                                  onPassword={() => openPassword(u)}
                                  onToggleActive={() => handleToggleActive(u)}
                                  onDelete={() => handleDelete(u)}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {/* ── EX-EMPLOYEES ── */}
          {exEmployees.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BlockedIcon className="w-5 h-5" />
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Ex-Employees</h2>
                <span className="text-xs text-gray-400">({exEmployees.length})</span>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Name</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Email</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Former Role</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Left On</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {exEmployees.map(u => (
                      <tr key={u.id} id={`user-${u.id}`} className={`hover:bg-gray-50 ${highlightRowClass(flashUserId === u.id)}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-bold">
                              {u.firstName.charAt(0)}{(u.lastName || '').charAt(0)}
                            </div>
                            <p className="font-medium text-gray-700">{u.firstName} {u.lastName}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}>
                            {ROLE_LABELS[u.role] || u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {u.deletedAt ? new Date(u.deletedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {isSuperAdmin ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              <button
                                onClick={() => openExRecords(u)}
                                className="px-2 py-1 text-xs rounded border border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                              >
                                View Records
                              </button>
                              <button
                                onClick={() => handleRestore(u)}
                                className="px-2 py-1 text-xs rounded border border-green-200 text-green-700 hover:bg-green-50"
                              >
                                Restore
                              </button>
                              <button
                                onClick={() => handlePermanentRemove(u)}
                                className="px-2 py-1 text-xs rounded border border-red-300 text-red-700 hover:bg-red-50"
                              >
                                Remove Permanently
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">Super Admin only</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><CloseIcon className="w-5 h-5" /></button>
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

      {/* ── ROLE SWITCH MODAL ── */}
      {modal === 'role-switch' && roleSwitchState && (() => {
        const rs = roleSwitchState;
        const isDemotion = rs.newRole === 'ON_FIELD_TEAM';
        const newRoleLabel = ROLE_LABELS[rs.newRole] || rs.newRole;
        const oldRoleLabel = ROLE_LABELS[rs.user.role] || rs.user.role;
        // Potential managers for subordinate reassignment (Backend / Admin, not the switching user)
        const potentialManagers = users.filter(u => u.isActive && u.id !== rs.user.id && (u.role === 'BACKEND_TEAM' || u.role === 'ADMIN'));
        // Transfer targets for leads/deals/tasks
        const transferTargets = users.filter(u => u.isActive && u.id !== rs.user.id);

        const updateRS = (patch: Partial<RoleSwitchState>) =>
          setRoleSwitchState(prev => prev ? { ...prev, ...patch } : prev);

        return (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Switch Role</h2>
                  <p className="text-sm text-gray-500">
                    {rs.user.firstName} {rs.user.lastName}: {oldRoleLabel} → {newRoleLabel}
                  </p>
                </div>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><CloseIcon className="w-5 h-5" /></button>
              </div>

              <div className="overflow-y-auto flex-1 p-6 space-y-5">
                {rs.loading ? (
                  <div className="py-10 text-center text-gray-400 text-sm">Loading ownership summary…</div>
                ) : rs.step === 'preview' ? (
                  <>
                    {/* Impact banner */}
                    <div className={`rounded-xl p-4 border ${isDemotion ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
                      <p className={`text-xs font-semibold mb-2 ${isDemotion ? 'text-amber-800' : 'text-blue-800'}`}>
                        {isDemotion ? '⚠ Demotion — review assignments below' : '↑ Promotion to Backend Team'}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {[
                          { label: 'Leads (assigned)', count: rs.leadsAssigned },
                          { label: 'Leads (brought)', count: rs.broughtLeads },
                          { label: 'Deals', count: rs.deals },
                          { label: 'Tasks', count: rs.tasks },
                          { label: 'Subordinates', count: rs.subordinates.length },
                        ].map(item => (
                          <div key={item.label} className="flex justify-between bg-white rounded-lg px-3 py-2 border">
                            <span className="text-gray-600">{item.label}</span>
                            <span className="font-semibold text-gray-900">{item.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Leads (assigned) */}
                    {rs.leadsAssigned > 0 && (
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-700">Leads assigned to them ({rs.leadsAssigned})</label>
                        <div className="flex gap-2">
                          <button onClick={() => updateRS({ leadsAction: 'keep' })} className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${ rs.leadsAction === 'keep' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50' }`}>Keep with them</button>
                          <button onClick={() => updateRS({ leadsAction: 'transfer' })} className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${ rs.leadsAction === 'transfer' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50' }`}>Transfer to →</button>
                        </div>
                        {rs.leadsAction === 'transfer' && (
                          <select value={rs.leadsTargetUserId} onChange={e => updateRS({ leadsTargetUserId: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                            <option value="">Select recipient…</option>
                            {transferTargets.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName} · {ROLE_LABELS[t.role] || t.role}</option>)}
                          </select>
                        )}
                      </div>
                    )}

                    {/* Leads (brought) */}
                    {rs.broughtLeads > 0 && (
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-700">Leads brought by them ({rs.broughtLeads})</label>
                        <div className="flex gap-2">
                          <button onClick={() => updateRS({ broughtLeadsAction: 'keep' })} className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${ rs.broughtLeadsAction === 'keep' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50' }`}>Keep with them</button>
                          <button onClick={() => updateRS({ broughtLeadsAction: 'transfer' })} className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${ rs.broughtLeadsAction === 'transfer' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50' }`}>Transfer to →</button>
                        </div>
                        {rs.broughtLeadsAction === 'transfer' && (
                          <select value={rs.broughtLeadsTargetUserId} onChange={e => updateRS({ broughtLeadsTargetUserId: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                            <option value="">Select recipient…</option>
                            {transferTargets.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName} · {ROLE_LABELS[t.role] || t.role}</option>)}
                          </select>
                        )}
                      </div>
                    )}

                    {/* Deals */}
                    {rs.deals > 0 && (
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-700">Deals assigned ({rs.deals})</label>
                        <div className="flex gap-2">
                          <button onClick={() => updateRS({ dealsAction: 'keep' })} className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${ rs.dealsAction === 'keep' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50' }`}>Keep with them</button>
                          <button onClick={() => updateRS({ dealsAction: 'transfer' })} className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${ rs.dealsAction === 'transfer' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50' }`}>Transfer to →</button>
                        </div>
                        {rs.dealsAction === 'transfer' && (
                          <select value={rs.dealsTargetUserId} onChange={e => updateRS({ dealsTargetUserId: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                            <option value="">Select recipient…</option>
                            {transferTargets.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName} · {ROLE_LABELS[t.role] || t.role}</option>)}
                          </select>
                        )}
                      </div>
                    )}

                    {/* Tasks */}
                    {rs.tasks > 0 && (
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-700">Tasks assigned ({rs.tasks})</label>
                        <div className="flex gap-2">
                          <button onClick={() => updateRS({ tasksAction: 'keep' })} className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${ rs.tasksAction === 'keep' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50' }`}>Keep with them</button>
                          <button onClick={() => updateRS({ tasksAction: 'transfer' })} className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${ rs.tasksAction === 'transfer' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50' }`}>Transfer to →</button>
                        </div>
                        {rs.tasksAction === 'transfer' && (
                          <select value={rs.tasksTargetUserId} onChange={e => updateRS({ tasksTargetUserId: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                            <option value="">Select recipient…</option>
                            {transferTargets.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName} · {ROLE_LABELS[t.role] || t.role}</option>)}
                          </select>
                        )}
                      </div>
                    )}

                    {/* Subordinates (demotion only — required) */}
                    {isDemotion && rs.subordinates.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-semibold text-gray-700">Team members reporting to them</label>
                          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Required</span>
                        </div>
                        <p className="text-xs text-gray-400">On Field Team members cannot be managers. Assign each a new manager.</p>

                        {/* Assign all shortcut */}
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 border">
                          <span className="text-xs text-gray-600 whitespace-nowrap">Assign all to →</span>
                          <select
                            className="flex-1 border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
                            onChange={e => {
                              if (!e.target.value) return;
                              const newMap = { ...rs.subordinateManagerMap };
                              rs.subordinates.forEach(s => { newMap[s.id] = e.target.value; });
                              updateRS({ subordinateManagerMap: newMap });
                            }}
                            defaultValue=""
                          >
                            <option value="">— Pick one for all —</option>
                            {potentialManagers.map(m => <option key={m.id} value={m.id}>{m.firstName} {m.lastName} · {ROLE_LABELS[m.role]}</option>)}
                          </select>
                        </div>

                        <div className="space-y-2">
                          {rs.subordinates.map(sub => (
                            <div key={sub.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-white">
                              <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                {sub.firstName.charAt(0)}{sub.lastName?.charAt(0) || ''}
                              </div>
                              <span className="flex-1 text-sm font-medium text-gray-800">{sub.firstName} {sub.lastName}</span>
                              <select
                                value={rs.subordinateManagerMap[sub.id] || ''}
                                onChange={e => updateRS({ subordinateManagerMap: { ...rs.subordinateManagerMap, [sub.id]: e.target.value } })}
                                className={`border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200 ${ !rs.subordinateManagerMap[sub.id] ? 'border-red-300 bg-red-50' : 'border-gray-300' }`}
                              >
                                <option value="">New manager…</option>
                                {potentialManagers.map(m => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {rs.leadsAssigned === 0 && rs.broughtLeads === 0 && rs.deals === 0 && rs.tasks === 0 && rs.subordinates.length === 0 && (
                      <div className="py-6 text-center text-sm text-gray-400">
                        This user owns no leads, deals, tasks, or subordinates.<br />
                        <span className="font-medium text-gray-600">The role switch will happen immediately.</span>
                      </div>
                    )}
                  </>
                ) : (
                  /* Confirm step */
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-gray-700">Ready to switch <span className="text-blue-600">{rs.user.firstName} {rs.user.lastName}</span> to {newRoleLabel}.</p>
                    <div className="rounded-xl border divide-y divide-gray-100 text-sm">
                      {rs.leadsAssigned > 0 && <div className="flex justify-between px-4 py-2.5"><span className="text-gray-600">Leads (assigned, {rs.leadsAssigned})</span><span className="font-medium text-gray-800">{rs.leadsAction === 'keep' ? 'Kept with them' : `→ ${transferTargets.find(t => t.id === rs.leadsTargetUserId)?.firstName || '?'}`}</span></div>}
                      {rs.broughtLeads > 0 && <div className="flex justify-between px-4 py-2.5"><span className="text-gray-600">Leads (brought, {rs.broughtLeads})</span><span className="font-medium text-gray-800">{rs.broughtLeadsAction === 'keep' ? 'Kept with them' : `→ ${transferTargets.find(t => t.id === rs.broughtLeadsTargetUserId)?.firstName || '?'}`}</span></div>}
                      {rs.deals > 0 && <div className="flex justify-between px-4 py-2.5"><span className="text-gray-600">Deals ({rs.deals})</span><span className="font-medium text-gray-800">{rs.dealsAction === 'keep' ? 'Kept with them' : `→ ${transferTargets.find(t => t.id === rs.dealsTargetUserId)?.firstName || '?'}`}</span></div>}
                      {rs.tasks > 0 && <div className="flex justify-between px-4 py-2.5"><span className="text-gray-600">Tasks ({rs.tasks})</span><span className="font-medium text-gray-800">{rs.tasksAction === 'keep' ? 'Kept with them' : `→ ${transferTargets.find(t => t.id === rs.tasksTargetUserId)?.firstName || '?'}`}</span></div>}
                      {isDemotion && rs.subordinates.length > 0 && rs.subordinates.map(sub => (
                        <div key={sub.id} className="flex justify-between px-4 py-2.5">
                          <span className="text-gray-600">{sub.firstName}'s manager</span>
                          <span className="font-medium text-gray-800">→ {potentialManagers.find(m => m.id === rs.subordinateManagerMap[sub.id])?.firstName || '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t flex items-center justify-between gap-3 flex-shrink-0">
                <button onClick={closeModal} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50" disabled={saving}>
                  Cancel
                </button>
                <div className="flex gap-2">
                  {rs.step === 'confirm' && (
                    <button onClick={() => updateRS({ step: 'preview' })} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50" disabled={saving}>
                      ← Back
                    </button>
                  )}
                  {rs.step === 'preview' ? (
                    <button
                      onClick={() => updateRS({ step: 'confirm' })}
                      disabled={rs.loading}
                      className="px-5 py-2 text-sm rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
                    >
                      Review & Confirm →
                    </button>
                  ) : (
                    <button
                      onClick={handleRoleSwitchSubmit}
                      disabled={saving}
                      className="px-5 py-2 text-sm rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50"
                    >
                      {saving ? 'Switching…' : `Confirm & Switch to ${newRoleLabel}`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── EX-EMPLOYEE RECORDS / ARCHIVE MODAL ── */}
      {modal === 'ex-records' && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold">Ex-Employee Records</h2>
                <p className="text-sm text-gray-500">{selectedUser.firstName} {selectedUser.lastName} · {selectedUser.email}</p>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><CloseIcon className="w-5 h-5" /></button>
            </div>

            <div className="overflow-y-auto p-6 space-y-5">
              {recordsLoading && <p className="text-sm text-gray-400">Loading records…</p>}

              {!recordsLoading && records && (
                <>
                  {/* Business records — must be reassigned */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-700">Business records</h3>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${records.businessTotal > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {records.businessTotal} total
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">These must be reassigned to a current employee before this account can be removed.</p>
                    <div className="border rounded-lg divide-y divide-gray-100">
                      {records.business.filter(r => r.count > 0).length === 0 ? (
                        <p className="px-3 py-2 text-xs text-gray-400 italic">None — ready to remove.</p>
                      ) : (
                        records.business.filter(r => r.count > 0).map(r => (
                          <div key={r.key} className="flex items-center justify-between px-3 py-2 text-sm">
                            <span className="text-gray-700">{r.label}</span>
                            <span className="font-semibold text-gray-900">{r.count}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Reassign control */}
                  {records.businessTotal > 0 && (
                    <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-100 space-y-2">
                      <label className="text-xs font-semibold text-indigo-800">Reassign all business records to</label>
                      <div className="flex gap-2">
                        <select
                          value={reassignTargetId}
                          onChange={e => setReassignTargetId(e.target.value)}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
                        >
                          <option value="">Select an active employee…</option>
                          {reassignTargets.map(t => (
                            <option key={t.id} value={t.id}>
                              {t.firstName} {t.lastName} · {ROLE_LABELS[t.role] || t.role}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={handleReassign}
                          disabled={!reassignTargetId || saving}
                          className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {saving ? 'Reassigning…' : 'Reassign'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Personal records — deleted on removal */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-700">Personal records</h3>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{records.personalTotal} total</span>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">Attendance, activity and time logs. These are deleted automatically when the account is removed.</p>
                    <div className="border rounded-lg divide-y divide-gray-100">
                      {records.personal.filter(r => r.count > 0).length === 0 ? (
                        <p className="px-3 py-2 text-xs text-gray-400 italic">None.</p>
                      ) : (
                        records.personal.filter(r => r.count > 0).map(r => (
                          <div key={r.key} className="flex items-center justify-between px-3 py-2 text-sm">
                            <span className="text-gray-700">{r.label}</span>
                            <span className="font-semibold text-gray-900">{r.count}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t flex items-center justify-between flex-shrink-0">
              <button onClick={closeModal} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
                Close
              </button>
              <button
                onClick={() => handlePermanentRemove(selectedUser)}
                disabled={!records || !records.canHardDelete}
                title={records && !records.canHardDelete ? 'Reassign all business records first' : ''}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50"
              >
                Remove Permanently
              </button>
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
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><CloseIcon className="w-5 h-5" /></button>
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
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><CloseIcon className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">First Name *</label>
                  <input required value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="e.g. Hema Priya" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Last Name</label>
                  <input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="e.g. B" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Email *</label>
                  <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="user@eorbitor.com" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
                  <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="+91 98765 43210" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Employee ID</label>
                  <input value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="e.g. EMP-1024" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Job Title</label>
                  <input value={form.jobTitle} onChange={e => setForm({ ...form, jobTitle: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="e.g. Senior Sales Executive" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Territory</label>
                <input value={form.assignedTerritory} onChange={e => setForm({ ...form, assignedTerritory: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="e.g. South India" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Initial Password *</label>
                <input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="eOrbitor@2024" />
                <p className="text-xs text-gray-400 mt-1">User should change this after first login</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Role *</label>
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value, managerId: '' })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                    {assignableRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">{ROLE_OPTIONS.find(r => r.value === form.role)?.desc}</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Department</label>
                  <select value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                    {DEPT_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              {form.role === 'ON_FIELD_TEAM' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Reports To (Manager)</label>
                  <select value={form.managerId} onChange={e => setForm({ ...form, managerId: e.target.value })}
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
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><CloseIcon className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEdit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">First Name *</label>
                  <input required value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Last Name</label>
                  <input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Role *</label>
                  <select
                    value={form.role}
                    onChange={e => setForm({ ...form, role: e.target.value, managerId: '' })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    disabled={selectedUser.id === currentUser?.id}
                  >
                    {assignableRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  {selectedUser.id === currentUser?.id && <p className="text-xs text-gray-400 mt-1">Cannot change your own role</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Department</label>
                  <select value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                    {DEPT_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
                  <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="+91 98765 43210" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Employee ID</label>
                  <input value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="e.g. EMP-1024" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Job Title</label>
                  <input value={form.jobTitle} onChange={e => setForm({ ...form, jobTitle: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="e.g. Senior Sales Executive" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Territory</label>
                  <input value={form.assignedTerritory} onChange={e => setForm({ ...form, assignedTerritory: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" placeholder="e.g. South India" />
                </div>
              </div>

              {form.role === 'ON_FIELD_TEAM' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Reports To (Manager)</label>
                  <select
                    value={form.managerId}
                    onChange={e => setForm({ ...form, managerId: e.target.value })}
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
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><CloseIcon className="w-5 h-5" /></button>
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
                    onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })}
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
                  onChange={e => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 ${pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword ? 'border-red-300' : ''
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
