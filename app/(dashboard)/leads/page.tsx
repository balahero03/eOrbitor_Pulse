'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Lead {
  id: string;
  name: string;
  company: string;
  status: string;
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

const ALL_STATUSES = [
  { value: 'SUSPECT',     label: 'Suspect' },
  { value: 'PROSPECT',    label: 'Prospect' },
  { value: 'NEGOTIATION', label: 'Negotiation' },
  { value: 'WON',         label: 'Won' },
  { value: 'LOST',        label: 'Lost' },
  { value: 'DROPPED',     label: 'Dropped' },
  { value: 'ON_HOLD',     label: 'On Hold' },
  { value: 'REJECTED',    label: 'Rejected' },
];

const EDIT_STATUSES = ALL_STATUSES;

function getStatusColor(status: string) {
  switch (status) {
    case 'WON':         return 'bg-green-100 text-green-800';
    case 'LOST':        return 'bg-red-100 text-red-800';
    case 'CONVERTED':   return 'bg-purple-100 text-purple-800';
    case 'NEGOTIATION': return 'bg-orange-100 text-orange-800';
    case 'PROSPECT':    return 'bg-cyan-100 text-cyan-800';
    case 'SUSPECT':     return 'bg-indigo-100 text-indigo-800';
    case 'DROPPED':     return 'bg-gray-100 text-gray-500';
    case 'ON_HOLD':     return 'bg-amber-100 text-amber-800';
    case 'REJECTED':    return 'bg-red-200 text-red-900';
    default:            return 'bg-blue-50 text-blue-700';
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
          {/* Change Status submenu trigger */}
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
              {EDIT_STATUSES.map(s => (
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

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  // Convert modal
  const [convertTarget, setConvertTarget] = useState<Lead | null>(null);
  const [converting, setConverting] = useState(false);

  useEffect(() => { fetchLeads(); }, [page, status]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
        ...(status && { status }),
        ...(search && { search }),
      });
      const res = await fetch(`/api/leads?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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
    if (!convertTarget) return;
    setConverting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          companyName: convertTarget.company,
          gstNumber: `PENDING-${Date.now()}`,
          industry: 'Other',
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Failed to convert: ${err.message || 'Unknown error'}`);
        return;
      }
      const customer = await res.json();
      await fetch(`/api/leads/${convertTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'CONVERTED', linkedCustomerId: customer.id }),
      });
      setConvertTarget(null);
      router.push(`/customers/${customer.id}`);
    } catch {
      alert('An error occurred during conversion.');
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Leads</h1>
        <a href="/leads/new" className="btn btn-primary">+ New Lead</a>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-4">
        <div className="flex gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Search by name, company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); fetchLeads(); } }}
            className="border rounded px-3 py-2 flex-1 min-w-48"
          />
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="border rounded px-3 py-2"
          >
            <option value="">All Status</option>
            {ALL_STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <button onClick={() => { setPage(1); fetchLeads(); }} className="btn btn-primary px-6">
            Search
          </button>
        </div>
      </div>

      {/* Status filter chips */}
      <div className="flex gap-2 flex-wrap mb-4">
        {ALL_STATUSES.map(s => (
          <button
            key={s.value}
            onClick={() => { setStatus(status === s.value ? '' : s.value); setPage(1); }}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              status === s.value
                ? getStatusColor(s.value) + ' border-current'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-500">Loading...</div>
        ) : leads.length === 0 ? (
          <div className="p-10 text-center text-gray-500">No leads found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Quote No</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Opportunity</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Customer</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Quote Value</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">RFQ Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Account Manager</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Remarks</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Actions</th>
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
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(lead.status)}`}>
                          {lead.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {lead.quoteValue ? `₹${Number(lead.quoteValue).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {lead.rfqDate ? new Date(lead.rfqDate).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {lead.assignedTo.firstName.charAt(0)}
                          </div>
                          <span className="text-gray-700">{lead.assignedTo.firstName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-48 truncate" title={lead.remarks || ''}>
                        {lead.remarks || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <ActionMenu
                          lead={lead}
                          onDelete={() => handleDelete(lead.id)}
                          onConvert={() => setConvertTarget(lead)}
                          onStatusChange={(s) => handleStatusChange(lead.id, s)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination && pagination.pages > 1 && (
              <div className="p-4 border-t flex items-center justify-between text-sm text-gray-600">
                <span>Showing {(page - 1) * pagination.limit + 1}–{Math.min(page * pagination.limit, pagination.total)} of {pagination.total}</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-secondary disabled:opacity-40">Prev</button>
                  <span className="px-3 py-1">{page} / {pagination.pages}</span>
                  <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages} className="btn btn-secondary disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Convert to Customer Modal */}
      {convertTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold mb-3">Convert to Customer?</h2>
            <p className="text-sm text-gray-600 mb-1">This will create a new customer record for:</p>
            <div className="bg-gray-50 rounded p-3 mb-4">
              <p className="font-semibold text-gray-800">{convertTarget.company}</p>
              <p className="text-sm text-gray-500">{convertTarget.name}</p>
            </div>
            <p className="text-xs text-gray-400 mb-5">
              The lead status will be updated to <strong>CONVERTED</strong> and linked to the new customer.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConvertTarget(null)} className="btn btn-secondary flex-1" disabled={converting}>
                Cancel
              </button>
              <button onClick={handleConvert} className="btn btn-primary flex-1 disabled:opacity-50" disabled={converting}>
                {converting ? 'Converting...' : 'Yes, Convert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
