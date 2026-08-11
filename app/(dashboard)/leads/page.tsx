'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import LiveSearchDropdown, { highlightMatch } from '@/components/LiveSearchDropdown';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { DropdownPortal } from '@/components/DropdownPortal';

interface Lead {
  id: string;
  name: string;
  company: string;
  status: string;
  source: string;
  quoteNo?: string;
  quoteValue?: number;
  rfqDate?: string;
  followUpDate?: string;
  remarks?: string;
  assignedTo: { firstName: string; lastName: string };
  broughtBy?: { firstName: string; lastName: string };
  linkedCustomer?: { id: string; companyName: string };
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

const ALL_STATUSES = [
  { value: 'SUSPECT', label: 'Suspect' },
  { value: 'PROSPECT', label: 'Prospect' },
  { value: 'PROPOSAL', label: 'Proposal' },
  { value: 'NEGOTIATION', label: 'Negotiation' },
  { value: 'CLOSURE', label: 'Closure' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'DROPPED', label: 'Dropped' },
];

const ALL_SOURCES = [
  { value: 'EMAIL', label: 'Email' },
  { value: 'WEBSITE', label: 'Website' },
  { value: 'REFERRAL', label: 'Referral' },
  { value: 'WALKIN', label: 'Walk-in' },
  { value: 'CALL', label: 'Call' },
  { value: 'ADVERTISEMENT', label: 'Advertisement' },
];

function getStatusColor(status: string) {
  switch (status) {
    case 'WON': return 'bg-green-100 text-green-800 border-green-300';
    case 'LOST': return 'bg-red-100 text-red-800 border-red-300';
    case 'CONVERTED': return 'bg-purple-100 text-purple-800 border-purple-300';
    case 'NEGOTIATION': return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'PROSPECT': return 'bg-cyan-100 text-cyan-800 border-cyan-300';
    case 'SUSPECT': return 'bg-slate-100 text-slate-700 border-slate-300';
    case 'PROPOSAL': return 'bg-indigo-100 text-indigo-800 border-indigo-300';
    case 'CLOSURE': return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'DROPPED': return 'bg-gray-100 text-gray-500 border-gray-300';
    case 'ON_HOLD': return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'REJECTED': return 'bg-red-200 text-red-900 border-red-400';
    default: return 'bg-blue-50 text-blue-700 border-blue-200';
  }
}

function ActionMenu({
  lead,
  onDelete,
  userRole,
}: {
  lead: Lead;
  onDelete: () => void;
  userRole: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ON_FIELD_TEAM cannot initiate any deletion — hide menu entirely
  const canRequestDelete = ['SUPER_ADMIN', 'ADMIN', 'BACKEND_TEAM'].includes(userRole);
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(userRole);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      // The panel is portaled to document.body (see DropdownPortal), so a
      // click inside it is no longer a descendant of the trigger — both
      // refs need checking, or the menu would close before its own item's
      // onClick fires.
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        panelRef.current && !panelRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!canRequestDelete) return null;

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
        title="Actions"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      <DropdownPortal anchorRef={triggerRef} open={open} panelRef={panelRef}>
        <div className="w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 animate-scale-in origin-top-right">
          <button
            onClick={() => { onDelete(); setOpen(false); }}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            {isAdmin ? 'Delete' : 'Request Deletion'}
          </button>
        </div>
      </DropdownPortal>
    </div>
  );
}

const EMPTY_FILTERS = {
  search: '',
  status: '',
  source: '',
  assignedToId: '',
  rfqFrom: '',
  rfqTo: '',
  followUpFrom: '',
  followUpTo: '',
  hasFollowUp: '',
  quoteValueMin: '',
  quoteValueMax: '',
};

export default function LeadsPage() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<User[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });
  const [applied, setApplied] = useState({ ...EMPTY_FILTERS });

  const activeFilterCount = Object.values(applied).filter(Boolean).length;

  // Fetch the logged-in user's profile so we can gate role-sensitive actions
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (u) setCurrentUser(u); })
      .catch(() => { });
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/users?active=true&limit=100', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setUsers(d.users || []));
  }, []);

  useEffect(() => { fetchLeads(); }, [page, applied]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ page: page.toString(), limit: '25' });
      Object.entries(applied).forEach(([k, v]) => { if (v) params.set(k, v); });

      const res = await fetch(`/api/leads?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { localStorage.removeItem('token'); window.location.href = '/login'; return; }
      if (!res.ok) throw new Error('Failed to fetch leads');
      const data = await res.json();
      setLeads(data.leads);
      setPagination(data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    setApplied({ ...filters });
    setPage(1);
    setShowFilters(false);
  };

  const clearFilters = () => {
    setFilters({ ...EMPTY_FILTERS });
    setApplied({ ...EMPTY_FILTERS });
    setPage(1);
  };

  const setF = (key: string, value: string) => setFilters(f => ({ ...f, [key]: value }));

  const fetchLeadSuggestions = useCallback(async (query: string): Promise<Lead[]> => {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({ search: query, page: '1', limit: '8' });
    const res = await fetch(`/api/leads?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Search failed');
    const data = await res.json();
    return (data.leads || []) as Lead[];
  }, []);

  const renderLeadSuggestion = (lead: Lead, query: string) => {
    const ownerName = lead.assignedTo ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName || ''}`.trim() : '';
    return (
      <div className="min-w-0">
        <div className="flex items-center gap-2 justify-between">
          <span className="text-sm font-semibold text-gray-900 truncate">{highlightMatch(lead.name, query)}</span>
          <span className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${getStatusColor(lead.status)}`}>
            {lead.status}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5 truncate">
          {highlightMatch(lead.company, query)}
          {lead.quoteNo ? ` · ${lead.quoteNo}` : ''}
          {ownerName ? <> · Owner: {highlightMatch(ownerName, query)}</> : ''}
        </p>
      </div>
    );
  };

  const isAdmin = currentUser && ['SUPER_ADMIN', 'ADMIN'].includes(currentUser.role);

  const handleDelete = async (id: string) => {
    const confirmed = isAdmin
      ? await confirm('This lead will be permanently deleted. This cannot be undone.', { title: 'Delete this lead?', danger: true })
      : await confirm('Submit this lead for deletion approval?', { title: 'Request deletion' });
    if (!confirmed) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: 'Deleted by admin' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (isAdmin) {
          toast.success('Lead deleted successfully.');
        } else {
          toast.success(`Deletion request submitted for approval (Request ID: ${data.requestId}).`);
        }
        fetchLeads();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(`Failed: ${err.message || 'Unknown error'}`);
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message || 'Failed'}`);
    }
  };

  return (
    <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Active pipeline — Suspect through Closure</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <a
            href="/closed-leads"
            className="px-3 sm:px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-colors whitespace-nowrap"
          >
            ← Closed Leads
          </a>
          <a
            href="/leads/new"
            className="px-3.5 sm:px-4 py-2 bg-blue-600 text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-blue-700 transition-colors whitespace-nowrap shadow-sm"
          >
            + New Lead
          </a>
        </div>
      </div>

      {/* Search bar + filter toggle */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3.5 sm:p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-stretch sm:items-center">
          <LiveSearchDropdown<Lead>
            value={filters.search}
            onChange={(v) => setF('search', v)}
            onSearch={applyFilters}
            fetchSuggestions={fetchLeadSuggestions}
            getKey={(l) => l.id}
            getHref={(l) => `/leads/${l.id}`}
            renderItem={renderLeadSuggestion}
            placeholder="Search by name, company, lead number, assigned user..."
            ariaLabel="Search leads"
            cacheKeyPrefix="leads"
            className="w-full sm:flex-1 min-w-0"
          />
          <div className="flex items-center gap-2 flex-shrink-0 justify-end">
            <button
              onClick={() => setShowFilters(f => !f)}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs sm:text-sm font-semibold transition-colors ${showFilters || activeFilterCount > 0
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
              </svg>
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-white text-blue-600 rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold ml-0.5">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button
              onClick={applyFilters}
              className="flex-1 sm:flex-initial px-4 py-2 bg-blue-600 text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm text-center"
            >
              Search
            </button>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-xs text-gray-500 hover:text-red-600 underline px-1">
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Expanded filter panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setF('status', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Statuses</option>
                  {ALL_STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Source */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Source</label>
                <select
                  value={filters.source}
                  onChange={(e) => setF('source', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Sources</option>
                  {ALL_SOURCES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Account Manager */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Account Manager</label>
                <select
                  value={filters.assignedToId}
                  onChange={(e) => setF('assignedToId', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Managers</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                  ))}
                </select>
              </div>

              {/* Follow-up status */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Follow-up</label>
                <select
                  value={filters.hasFollowUp}
                  onChange={(e) => setF('hasFollowUp', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Any</option>
                  <option value="yes">Has Follow-up Date</option>
                  <option value="no">No Follow-up Date</option>
                </select>
              </div>

              {/* RFQ Date range */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">RFQ Date From</label>
                <input
                  type="date"
                  value={filters.rfqFrom}
                  onChange={(e) => setF('rfqFrom', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">RFQ Date To</label>
                <input
                  type="date"
                  value={filters.rfqTo}
                  onChange={(e) => setF('rfqTo', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Follow-up Date range */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Follow-up From</label>
                <input
                  type="date"
                  value={filters.followUpFrom}
                  onChange={(e) => setF('followUpFrom', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Follow-up To</label>
                <input
                  type="date"
                  value={filters.followUpTo}
                  onChange={(e) => setF('followUpTo', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Quote Value range */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Quote Value Min (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 10000"
                  value={filters.quoteValueMin}
                  onChange={(e) => setF('quoteValueMin', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Quote Value Max (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 500000"
                  value={filters.quoteValueMax}
                  onChange={(e) => setF('quoteValueMax', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={applyFilters}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                Apply Filters
              </button>
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Status quick-filter chips — horizontal scroll on mobile */}
      <div className="flex gap-2 overflow-x-auto pb-2 whitespace-nowrap mb-4 scrollbar-none max-w-full">
        <button
          onClick={() => { setFilters(f => ({ ...f, status: '' })); setApplied(f => ({ ...f, status: '' })); setPage(1); }}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${!applied.status ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
            }`}
        >
          All
        </button>
        {ALL_STATUSES.map(s => (
          <button
            key={s.value}
            onClick={() => {
              const next = applied.status === s.value ? '' : s.value;
              setFilters(f => ({ ...f, status: next }));
              setApplied(f => ({ ...f, status: next }));
              setPage(1);
            }}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${applied.status === s.value
                ? getStatusColor(s.value)
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
              }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Active filter tags */}
      {activeFilterCount > 0 && (
        <div className="flex gap-2 flex-wrap mb-3">
          {applied.assignedToId && (
            <FilterTag
              label={`Manager: ${users.find(u => u.id === applied.assignedToId)?.firstName || '...'}`}
              onRemove={() => { setFilters(f => ({ ...f, assignedToId: '' })); setApplied(f => ({ ...f, assignedToId: '' })); }}
            />
          )}
          {applied.source && (
            <FilterTag
              label={`Source: ${ALL_SOURCES.find(s => s.value === applied.source)?.label || applied.source}`}
              onRemove={() => { setFilters(f => ({ ...f, source: '' })); setApplied(f => ({ ...f, source: '' })); }}
            />
          )}
          {applied.hasFollowUp && (
            <FilterTag
              label={applied.hasFollowUp === 'yes' ? 'Has Follow-up' : 'No Follow-up'}
              onRemove={() => { setFilters(f => ({ ...f, hasFollowUp: '' })); setApplied(f => ({ ...f, hasFollowUp: '' })); }}
            />
          )}
          {(applied.rfqFrom || applied.rfqTo) && (
            <FilterTag
              label={`RFQ: ${applied.rfqFrom || '…'} → ${applied.rfqTo || '…'}`}
              onRemove={() => { setFilters(f => ({ ...f, rfqFrom: '', rfqTo: '' })); setApplied(f => ({ ...f, rfqFrom: '', rfqTo: '' })); }}
            />
          )}
          {(applied.followUpFrom || applied.followUpTo) && (
            <FilterTag
              label={`Follow-up: ${applied.followUpFrom || '…'} → ${applied.followUpTo || '…'}`}
              onRemove={() => { setFilters(f => ({ ...f, followUpFrom: '', followUpTo: '' })); setApplied(f => ({ ...f, followUpFrom: '', followUpTo: '' })); }}
            />
          )}
          {(applied.quoteValueMin || applied.quoteValueMax) && (
            <FilterTag
              label={`Value: ₹${applied.quoteValueMin || '0'} – ₹${applied.quoteValueMax || '∞'}`}
              onRemove={() => { setFilters(f => ({ ...f, quoteValueMin: '', quoteValueMax: '' })); setApplied(f => ({ ...f, quoteValueMin: '', quoteValueMax: '' })); }}
            />
          )}
        </div>
      )}

      {/* Summary row */}
      {pagination && (
        <p className="text-xs text-gray-500 mb-2">
          {pagination.total} lead{pagination.total !== 1 ? 's' : ''} found
          {activeFilterCount > 0 ? ` · ${activeFilterCount} filter${activeFilterCount !== 1 ? 's' : ''} active` : ''}
        </p>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-500">Loading...</div>
        ) : leads.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            No leads found
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="ml-2 text-blue-600 underline">clear filters</button>
            )}
          </div>
        ) : (
          <>
            {/* Card list (< 1024px). Eleven columns cannot be read on a tablet;
                below lg the cards carry the same fields legibly. */}
            <div className="block lg:hidden divide-y divide-gray-100">
              {leads.map((lead) => (
                <div
                  key={lead.id}
                  onClick={() => router.push(`/leads/${lead.id}`)}
                  className="p-4 active:bg-blue-50/70 transition-colors cursor-pointer space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {lead.quoteNo && (
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-semibold">
                            {lead.quoteNo}
                          </span>
                        )}
                        <h3 className="font-bold text-gray-900 text-sm">{lead.name}</h3>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{lead.company}</p>
                    </div>
                    <span className={`inline-block text-[11px] px-2.5 py-0.5 rounded-full border font-semibold flex-shrink-0 ${getStatusColor(lead.status)}`}>
                      {lead.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-50">
                    <div>
                      {lead.quoteValue ? (
                        <span className="font-bold text-gray-900 text-sm">₹{Number(lead.quoteValue).toLocaleString('en-IN')}</span>
                      ) : (
                        <span className="text-gray-400">No quote value</span>
                      )}
                    </div>
                    {lead.assignedTo && (
                      <div className="flex items-center gap-1.5 text-gray-600 text-xs">
                        <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                          {lead.assignedTo.firstName.charAt(0)}
                        </div>
                        <span>{lead.assignedTo.firstName}</span>
                      </div>
                    )}
                  </div>

                  {lead.followUpDate && (
                    <div className="text-[11px] flex items-center gap-1 text-gray-500">
                      <span>Follow-up:</span>
                      <span className={new Date(lead.followUpDate) < new Date() ? 'text-red-600 font-bold' : 'text-gray-700'}>
                        {new Date(lead.followUpDate).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Table (>= 1024px). min-w keeps the columns at a readable width and
                lets the container scroll, instead of compressing every cell
                until the text wraps mid-word. */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm min-w-[1180px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Lead Number</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Opportunity</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Source</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Quote Value</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">RFQ Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Follow-up</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Account Manager</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Remarks</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="hover:bg-blue-50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/leads/${lead.id}`)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        {lead.quoteNo || '—'}
                      </td>
                      <td className="px-4 py-3 font-medium text-blue-700 hover:underline">
                        {lead.name}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <div className="flex flex-col gap-0.5">
                          <span>{lead.company}</span>
                          {lead.linkedCustomer && (
                            <a
                              href={`/customers/${lead.linkedCustomer.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-purple-600 hover:underline"
                            >
                              ↗ Customer record
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block whitespace-nowrap text-xs px-2.5 py-1 rounded-full border font-medium ${getStatusColor(lead.status)}`}>
                          {lead.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {lead.source ? lead.source.charAt(0) + lead.source.slice(1).toLowerCase() : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {lead.quoteValue ? `₹${Number(lead.quoteValue).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {lead.rfqDate ? new Date(lead.rfqDate).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {lead.followUpDate ? (
                          <span className={`${new Date(lead.followUpDate) < new Date() ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                            {new Date(lead.followUpDate).toLocaleDateString('en-IN')}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {lead.assignedTo ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                              {lead.assignedTo.firstName.charAt(0)}
                            </div>
                            <span className="text-gray-700">{lead.assignedTo.firstName}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic text-xs">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-40 truncate" title={lead.remarks || ''}>
                        {lead.remarks || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <ActionMenu
                          lead={lead}
                          onDelete={() => handleDelete(lead.id)}
                          userRole={currentUser?.role || ''}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination && pagination.pages > 1 && (
              <div className="p-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-600">
                <span>
                  Showing {(page - 1) * pagination.limit + 1}–{Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
                </span>
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Prev
                  </button>
                  <span className="px-3 py-1">{page} / {pagination.pages}</span>
                  <button
                    onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                    disabled={page === pagination.pages}
                    className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}

function FilterTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium border border-blue-200">
      {label}
      <button onClick={onRemove} className="hover:text-blue-900 ml-0.5">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}
