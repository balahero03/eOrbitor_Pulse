'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import TimeField from '@/components/TimeField';
import { FollowUpIcon } from '@/components/icons';
import { useConfirm } from '@/components/ConfirmDialog';
import { buttonClasses } from '@/components/Button';
import NumberField from '@/components/NumberField';
import { InlineLoader } from '@/components/BrandedLoader';

const TYPE_LABEL: Record<string, string> = {
  CALL: 'Call', EMAIL: 'Email', MEETING: 'Meeting',
  WHATSAPP: 'WhatsApp', SITE_VISIT: 'Site Visit',
};

const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

const fmtDuration = (mins: number) =>
  mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60 ? `${mins % 60}m` : ''}`.trim() : `${mins}m`;

interface FollowUp {
  id: string;
  type: string;
  scheduledDate: string;
  actualDate?: string;
  durationMinutes?: number;
  notes?: string;
  outcome?: string;
  nextAction?: string;
  deal: { id: string; dealName: string; customer: { id: string; companyName: string } };
  lead?: { id: string; name: string };
  createdBy: { id: string; firstName: string; lastName: string };
  createdAt: string;
}

export default function FollowUpDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const confirm = useConfirm();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [followUp, setFollowUp] = useState<FollowUp | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    type: '',
    actualDate: '',
    actualTime: '',
    durationMinutes: '',
    notes: '',
    outcome: '',
    nextAction: '',
  });

  useEffect(() => {
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(u => setCurrentUser(u));
  }, []);

  useEffect(() => {
    fetchFollowUp();
  }, [id]);

  const fetchFollowUp = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/followups/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch follow-up');

      const data = await res.json();
      setFollowUp(data);
      setFormData({
        type: data.type,
        actualDate: data.actualDate ? new Date(data.actualDate).toISOString().split('T')[0] : '',
        actualTime: data.actualDate ? new Date(data.actualDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
        durationMinutes: data.durationMinutes?.toString() || '',
        notes: data.notes || '',
        outcome: data.outcome || '',
        nextAction: data.nextAction || '',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!followUp) return;

    setSaving(true);
    try {
      const actualDateTime = formData.actualDate && formData.actualTime
        ? new Date(`${formData.actualDate}T${formData.actualTime}`).toISOString()
        : null;

      const token = localStorage.getItem('token');
      const res = await fetch(`/api/followups/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: formData.type,
          actualDate: actualDateTime,
          durationMinutes: formData.durationMinutes ? parseInt(formData.durationMinutes) : null,
          notes: formData.notes,
          outcome: formData.outcome,
          nextAction: formData.nextAction,
        }),
      });

      if (!res.ok) throw new Error('Failed to update follow-up');

      const updated = await res.json();
      setFollowUp(updated);
      setEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!(await confirm('This follow-up will be permanently deleted.', { title: 'Delete this follow-up?', danger: true }))) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/followups/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        router.push('/followups');
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <InlineLoader message="Loading follow-up…" />;
  if (!followUp) return <div className="p-6 text-center">Follow-up not found</div>;

  const canManage = !!(currentUser && (['SUPER_ADMIN', 'ADMIN'].includes(currentUser.role) || followUp.createdBy.id === currentUser.id));
  const done = !!followUp.actualDate;
  const overdue = !done && new Date(followUp.scheduledDate) < new Date();

  return (
    <div className="p-3 sm:p-6 space-y-3 sm:space-y-5">
      {/* Header card, matching the shape every other list/detail page uses:
          identity and status on the left, actions on the right. */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-4 flex items-start sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 flex items-center gap-2 min-w-0">
              <FollowUpIcon type={followUp.type} className="w-5 h-5 sm:w-7 sm:h-7 flex-shrink-0" />
              <span className="truncate">{TYPE_LABEL[followUp.type] || followUp.type}</span>
            </h1>
            <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold whitespace-nowrap ${
              done ? 'bg-green-50 text-green-700 border-green-200'
                : overdue ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}>
              {done ? 'Completed' : overdue ? 'Overdue' : 'Scheduled'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5 truncate">
            {followUp.deal?.customer?.companyName || followUp.deal?.dealName || 'Follow-up'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!editing && canManage && (
            <button onClick={() => setEditing(true)} className={buttonClasses({ size: 'sm' })}>
              Edit
            </button>
          )}
          <Link href="/followups" className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'whitespace-nowrap' })}>
            <span className="hidden xs:inline">Back to </span>Follow-ups
          </Link>
        </div>
      </div>

      {/* Single column until `lg` — see products/[id]; the sidebar is unusable
          at a third of a phone's width. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-3 sm:space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3.5 sm:p-6">
            {editing ? (
              <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full"
                  >
                    <option value="CALL">Call</option>
                    <option value="EMAIL">Email</option>
                    <option value="MEETING">Meeting</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="SITE_VISIT">Site Visit</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Actual Date</label>
                    <input
                      type="date"
                      value={formData.actualDate}
                      onChange={(e) => setFormData({ ...formData, actualDate: e.target.value })}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Actual Time</label>
                    <TimeField
                      value={formData.actualTime}
                      onChange={(v) => setFormData({ ...formData, actualTime: v })}
                      className="w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Duration</label>
                  <NumberField
                    suffix="min"
                    value={formData.durationMinutes}
                    onChange={(v) => setFormData({ ...formData, durationMinutes: v })}
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full h-20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Outcome</label>
                  <textarea
                    value={formData.outcome}
                    onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
                    placeholder="Summary of what was discussed..."
                    className="w-full h-20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Next Action</label>
                  <textarea
                    value={formData.nextAction}
                    onChange={(e) => setFormData({ ...formData, nextAction: e.target.value })}
                    placeholder="What's the next step..."
                    className="w-full h-20"
                  />
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    disabled={saving}
                    className={buttonClasses({ variant: 'secondary', size: 'lg', className: 'w-full sm:w-auto' })}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className={buttonClasses({ size: 'lg', className: 'w-full sm:w-auto' })}
                  >
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-5">
                {/* Scheduled vs actual side by side — the whole point of a
                    follow-up record is whether it happened when it was meant
                    to, and that comparison was previously two unrelated rows
                    stacked far apart. */}
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-2">Timing</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Scheduled</p>
                      <p className="text-base font-bold text-gray-800 mt-1 tabular-nums">{fmtDateTime(followUp.scheduledDate)}</p>
                    </div>
                    <div className={`rounded-xl border p-3 ${done ? 'border-green-200 bg-green-50' : 'border-dashed border-gray-200 bg-white'}`}>
                      <p className={`text-[11px] font-semibold uppercase tracking-wider ${done ? 'text-green-600' : 'text-gray-400'}`}>
                        Actually happened
                      </p>
                      {done ? (
                        <p className="text-base font-bold text-green-700 mt-1 tabular-nums">{fmtDateTime(followUp.actualDate!)}</p>
                      ) : (
                        <p className="text-sm text-gray-400 mt-1.5 italic">Not logged yet</p>
                      )}
                    </div>
                  </div>
                  {followUp.durationMinutes ? (
                    <p className="text-xs text-gray-500 mt-2">
                      Lasted <span className="font-semibold text-gray-700">{fmtDuration(followUp.durationMinutes)}</span>
                    </p>
                  ) : null}
                </div>

                {/* Free-text blocks share one treatment instead of three
                    slightly different ones. */}
                {[
                  { label: 'Notes', value: followUp.notes },
                  { label: 'Outcome', value: followUp.outcome },
                  { label: 'Next Action', value: followUp.nextAction },
                ].filter(f => f.value).map(f => (
                  <div key={f.label} className="border-t border-gray-100 pt-4">
                    <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-1.5">{f.label}</p>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line break-words">{f.value}</p>
                  </div>
                ))}

                {!followUp.notes && !followUp.outcome && !followUp.nextAction && (
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-sm text-gray-400 italic">
                      No notes, outcome or next action recorded{canManage ? ' — use Edit to add them.' : '.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-3 sm:space-y-4">
          {/* Related Deal — now links through, which it never did. */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3.5 sm:p-5">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Related Deal</h3>
            {followUp.deal ? (
              <>
                <p className="text-sm font-semibold text-gray-900 break-words">{followUp.deal.dealName}</p>
                {followUp.deal.customer?.companyName && (
                  <p className="text-sm text-gray-500 mt-0.5 break-words">{followUp.deal.customer.companyName}</p>
                )}
                {followUp.lead?.id && (
                  <Link href={`/leads/${followUp.lead.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline mt-2.5">
                    Open lead →
                  </Link>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400 italic">No deal linked</p>
            )}
          </div>

          {/* Logged By — an avatar chip, matching the People panel on a lead. */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3.5 sm:p-5">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Logged By</h3>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {followUp.createdBy.firstName.charAt(0)}{followUp.createdBy.lastName.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {followUp.createdBy.firstName} {followUp.createdBy.lastName}
                </p>
                <p className="text-[11px] text-gray-400">
                  {new Date(followUp.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>

          {canManage && (
            <div className="bg-white rounded-xl border border-red-100 shadow-sm p-3.5 sm:p-5">
              <h3 className="text-sm font-semibold text-gray-600 mb-1">Danger Zone</h3>
              <p className="text-xs text-gray-400 mb-3">This cannot be undone.</p>
              <button onClick={handleDelete} className={buttonClasses({ variant: 'danger', size: 'lg', fullWidth: true })}>
                Delete Follow-up
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
