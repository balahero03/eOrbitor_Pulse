'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { buttonClasses } from '@/components/Button';
import CustomerAutocomplete, { primaryContact, type CustomerSuggestion } from '@/components/CustomerAutocomplete';
import { CheckGlyph } from '@/components/icons';
import SearchableSelect from '@/components/SearchableSelect';

interface User {
  id: string;
  firstName: string;
  lastName: string;
}

const INITIAL_STATUS = 'SUSPECT';

export default function NewLeadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [autofilled, setAutofilled] = useState<{ filled: string[]; missingPhone: boolean } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    address: '',
    source: 'EMAIL',
    remarks: '',
    assignedToId: '',
    expectedClosureDate: '',
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/users?active=true', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setUsers(Array.isArray(d.users) ? d.users : Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Picking an existing customer fills the contact details we already hold for
  // them. Only *blank* fields are written: if someone has already typed an
  // email or mobile for this lead, that is the more specific information and
  // silently overwriting it would lose their work. The lead's own Name field
  // fills from the primary contact on the same terms.
  //
  // `Contact.phone` is nullable in the schema while `email` is not, so "picked a
  // customer" does not imply "got a mobile number". The note below reports what
  // was actually written rather than assuming, because a blank Mobile field
  // beside a cheerful "details filled" message just looks broken.
  const applyCustomer = (c: CustomerSuggestion) => {
    const p = primaryContact(c);
    // Read the live form state directly rather than from inside the updater —
    // a state updater must stay pure, and React invokes it twice under
    // StrictMode. In an event handler `formData` is already the current value.
    const filled: string[] = [];
    if (!formData.email && p.email) filled.push('email');
    if (!formData.phone && p.phone) filled.push('mobile');

    setFormData(prev => ({
      ...prev,
      company: c.companyName,
      name: prev.name || p.name || '',
      email: prev.email || p.email || '',
      phone: prev.phone || p.phone || '',
    }));
    setAutofilled({ filled, missingPhone: !p.phone });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const payload: any = { ...formData };

      if (!payload.remarks) delete payload.remarks;
      if (!payload.assignedToId) delete payload.assignedToId;
      if (!payload.expectedClosureDate) delete payload.expectedClosureDate;

      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to create lead');
      }

      const newLead = await res.json();
      router.push(`/leads/${newLead.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-lg sm:text-2xl font-bold text-gray-900">New Lead (Suspect)</h1>
        <Link href="/leads" className={buttonClasses({ variant: 'secondary', className: 'w-full sm:w-auto' })}>Back to Leads</Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-8 max-w-2xl">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
          <p className="text-sm text-indigo-800">
            <strong>Suspect Stage:</strong> Enter basic lead information. Later, you can convert this to Prospect and add solution areas, OEM partners, and presales team details.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Lead Info */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">Lead Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1"> Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Name of the opportunity or lead"
                  required
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Company / Organization *</label>
                <CustomerAutocomplete
                  name="company"
                  value={formData.company}
                  onChange={v => setFormData(prev => ({ ...prev, company: v }))}
                  onSelectCustomer={applyCustomer}
                  placeholder="e.g. ABC Industries"
                  required
                  inputClassName="border rounded px-3 py-2"
                />
                {autofilled && (autofilled.filled.length > 0 ? (
                  <p className="text-xs text-green-700 mt-1 flex items-start gap-1">
                    <CheckGlyph className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                    <span>
                      Filled {autofilled.filled.join(' and ')} from this customer&apos;s primary contact — edit if this lead has a different contact.
                      {autofilled.missingPhone && ' No mobile number is on file for them.'}
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">
                    {autofilled.missingPhone
                      ? 'No mobile number on file for this customer — enter it below.'
                      : 'Kept the contact details you already entered.'}
                  </p>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Source</label>
                <select
                  name="source"
                  value={formData.source}
                  onChange={handleChange}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="EMAIL">Email</option>
                  <option value="REFERRAL">Referral</option>
                  <option value="WALKIN">Walk-in</option>
                  <option value="CALL">Phone Call</option>
                  <option value="WEBSITE">Website</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="ADVERTISEMENT">Advertisement</option>
                </select>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">Contact Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="contact@company.com"
                  required
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone *</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  required
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Address *</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Complete office address"
                  required
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">Timeline</h3>
            <div>
              <label className="block text-sm font-medium mb-1">Expected Closure Date</label>
              <input
                type="date"
                name="expectedClosureDate"
                value={formData.expectedClosureDate}
                onChange={handleChange}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          {/* Assignment */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">Assignment</h3>
            <div>
              <label className="block text-sm font-medium mb-1">Account Manager</label>
              <SearchableSelect
                value={formData.assignedToId}
                onChange={(v) => setFormData(prev => ({ ...prev, assignedToId: v }))}
                emptyOptionLabel="— Current User —"
                options={users.map(u => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }))}
              />
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-sm font-medium mb-1">Remarks / Notes</label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              placeholder="Any additional notes about this lead..."
              rows={3}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className={buttonClasses({ size: 'lg', className: 'flex-1' })}
            >
              {loading ? 'Creating...' : 'Create Suspect Lead'}
            </button>
            <Link href="/leads" className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 text-center">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
