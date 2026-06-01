'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

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
  { value: 'SUSPECT',     label: 'Suspect' },
  { value: 'PROSPECT',    label: 'Prospect' },
  { value: 'APPROACH',    label: 'Approach' },
  { value: 'NEGOTIATION', label: 'Negotiation' },
  { value: 'CLOSURE',     label: 'Closure' },
  { value: 'ON_HOLD',     label: 'On Hold' },
];

const ALL_SOURCES = [
  { value: 'EMAIL',         label: 'Email' },
  { value: 'WEBSITE',       label: 'Website' },
  { value: 'REFERRAL',      label: 'Referral' },
  { value: 'WALKIN',        label: 'Walk-in' },
  { value: 'CALL',          label: 'Call' },
  { value: 'ADVERTISEMENT', label: 'Advertisement' },
];

function getStatusColor(status: string) {
  switch (status) {
    case 'WON':         return 'bg-green-100 text-green-800 border-green-300';
    case 'LOST':        return 'bg-red-100 text-red-800 border-red-300';
    case 'CONVERTED':   return 'bg-purple-100 text-purple-800 border-purple-300';
    case 'NEGOTIATION': return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'PROSPECT':    return 'bg-cyan-100 text-cyan-800 border-cyan-300';
    case 'SUSPECT':     return 'bg-slate-100 text-slate-700 border-slate-300';
    case 'APPROACH':    return 'bg-indigo-100 text-indigo-800 border-indigo-300';
    case 'CLOSURE':     return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'DROPPED':     return 'bg-gray-100 text-gray-500 border-gray-300';
    case 'ON_HOLD':     return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'REJECTED':    return 'bg-red-200 text-red-900 border-red-400';
    default:            return 'bg-blue-50 text-blue-700 border-blue-200';
  }
}

function ActionMenu({
  lead,
  onDelete,
  onConvert,
  onStatusChange,
}: {
  lead: Lead;
  onDelete: () => void;
  onConvert: () => void;
  onStatusChange: (status: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowStatusMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const canConvert = ['PROSPECT', 'NEGOTIATION', 'WON'].includes(lead.status);

  return (
    <div className="relative" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => { setOpen(!open); setShowStatusMenu(false); }}
        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
        title="Actions"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
          <button
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between"
            onClick={() => setShowStatusMenu(!showStatusMenu)}
          >
            <span>Change Status</span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {showStatusMenu && (
            <div className="border-t border-gray-100 py-1">
              {ALL_STATUSES.map(s => (
                <button
                  key={s.value}
                  onClick={() => { onStatusChange(s.value); setOpen(false); setShowStatusMenu(false); }}
                  className={`w-full text-left px-6 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2 ${lead.status === s.value ? 'font-semibold text-blue-600' : 'text-gray-700'}`}
                >
                  <span className={`w-2 h-2 rounded-full inline-block ${getStatusColor(s.value).split(' ')[0]}`} />
                  {s.label}
                  {lead.status === s.value && ' ✓'}
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-gray-100 mt-1 pt-1">
            {canConvert && (
              <button
                onClick={() => { onConvert(); setOpen(false); }}
                className="w-full text-left px-4 py-2 text-sm text-purple-700 hover:bg-purple-50"
              >
                Convert to Customer
              </button>
            )}
            <button
              onClick={() => { onDelete(); setOpen(false); }}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>
      )}
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
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<User[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });
  const [applied, setApplied] = useState({ ...EMPTY_FILTERS });

  const convertTarget = useRef<Lead | null>(null);
  const [convertModal, setConvertModal] = useState(false);
  const [converting, setConverting] = useState(false);

  const activeFilterCount = Object.values(applied).filter(Boolean).length;

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/users?limit=100', { headers: { Authorization: `Bearer ${token}` } })
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

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this lead?')) return;
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/leads/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setLeads(leads.filter(l => l.id !== id));
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      const updated = await res.json();
      setLeads(leads.map(l => l.id === id ? { ...l, status: newStatus, linkedCustomer: updated.linkedCustomer || l.linkedCustomer } : l));
    }
  };

  const handleConvert = async () => {
    if (!convertTarget.current) return;
    setConverting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          companyName: convertTarget.current.company,
          gstNumber: `PENDING-${Date.now()}`,
          industry: 'Other',
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Failed: ${err.message || 'Unknown error'}`);
        return;
      }
      const customer = await res.json();
      await fetch(`/api/leads/${convertTarget.current.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'CONVERTED', linkedCustomerId: customer.id }),
      });
      setConvertModal(false);
      router.push(`/customers/${customer.id}`);
    } catch {
      alert('An error occurred during conversion.');
    } finally {
      setConverting(false);
    }
  };

  const openConvert = (lead: Lead) => {
    convertTarget.current = lead;
    setConvertModal(true);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500 mt-0.5">Active pipeline — Suspect through Closure</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/leads/closed"
            className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            View Closed Leads →
          </a>
          <a
            href="/leads/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            + New Lead
          </a>
        </div>
      </div>

      {/* Search bar + filter toggle */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
        <div className="flex gap-3 flex-wrap items-center">
          <input
            type="text"
            placeholder="Search by name, company, quote no, remarks..."
            value={filters.search}
            onChange={(e) => setF('search', e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') applyFilters(); }}
            className="border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-64 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              showFilters || activeFilterCount > 0
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-white text-blue-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={applyFilters}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-red-600 underline">
              Clear all
            </button>
          )}
        </div>

        {/* Expanded filter panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">

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

      {/* Status quick-filter chips */}
      <div className="flex gap-2 flex-wrap mb-4">
        <button
          onClick={() => { setFilters(f => ({ ...f, status: '' })); setApplied(f => ({ ...f, status: '' })); setPage(1); }}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
            !applied.status ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
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
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              applied.status === s.value
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Quote No</th>
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
                        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${getStatusColor(lead.status)}`}>
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
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {lead.assignedTo.firstName.charAt(0)}
                          </div>
                          <span className="text-gray-700">{lead.assignedTo.firstName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-40 truncate" title={lead.remarks || ''}>
                        {lead.remarks || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <ActionMenu
                          lead={lead}
                          onDelete={() => handleDelete(lead.id)}
                          onConvert={() => openConvert(lead)}
                          onStatusChange={(s) => handleStatusChange(lead.id, s)}
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

      {/* Convert to Customer Modal */}
      {convertModal && convertTarget.current && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl border border-gray-200">
            <h2 className="text-lg font-bold mb-3 text-gray-900">Convert to Customer?</h2>
            <p className="text-sm text-gray-600 mb-1">This will create a new customer record for:</p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 border border-gray-200">
              <p className="font-semibold text-gray-800">{convertTarget.current.company}</p>
              <p className="text-sm text-gray-500">{convertTarget.current.name}</p>
            </div>
            <p className="text-xs text-gray-400 mb-5">
              The lead status will be updated to <strong>CONVERTED</strong> and linked to the new customer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConvertModal(false)}
                disabled={converting}
                className="flex-1 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConvert}
                disabled={converting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {converting ? 'Converting...' : 'Yes, Convert'}
              </button>
            </div>
          </div>
        </div>
      )}
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
