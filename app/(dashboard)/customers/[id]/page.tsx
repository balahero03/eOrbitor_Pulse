'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  designation?: string;
  isPrimary: boolean;
  createdAt: string;
}

interface Deal {
  id: string;
  dealName: string;
  stage: string;
  dealValue: number;
  winProbability: number;
}

interface CustomerDetail {
  id: string;
  companyName: string;
  industry: string;
  website?: string;
  annualRevenue?: number;
  contacts: Contact[];
  deals: Deal[];
  activityLogs: any[];
  createdAt: string;
}

export default function CustomerDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    phone: '',
    designation: '',
    isPrimary: false,
  });

  useEffect(() => {
    fetchCustomer();
  }, [id]);

  const fetchCustomer = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/customers/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 404) {
          setError('Customer not found or has been deleted');
          setTimeout(() => router.push('/customers'), 2000);
        } else {
          setError('Failed to fetch customer');
        }
        return;
      }

      const data = await res.json();
      setCustomer(data);
    } catch (err) {
      console.error(err);
      setError('Error loading customer');
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = async () => {
    if (!contactForm.name || !contactForm.email) {
      alert('Name and email are required');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const method = editingId ? 'PATCH' : 'POST';
      const url = editingId
        ? `/api/customers/${id}/contacts/${editingId}`
        : `/api/customers/${id}/contacts`;

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(contactForm),
      });

      if (!res.ok) throw new Error('Failed to save contact');

      setContactForm({ name: '', email: '', phone: '', designation: '', isPrimary: false });
      setShowContactForm(false);
      setEditingId(null);
      fetchCustomer();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Are you sure?')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/customers/${id}/contacts/${contactId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        fetchCustomer();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditContact = (contact: Contact) => {
    setContactForm({
      name: contact.name,
      email: contact.email,
      phone: contact.phone || '',
      designation: contact.designation || '',
      isPrimary: contact.isPrimary,
    });
    setEditingId(contact.id);
    setShowContactForm(true);
  };

  const formatCurrency = (value?: number) => {
    if (!value) return 'N/A';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (loading) return <div className="p-6 text-center">Loading...</div>;

  if (error) {
    return (
      <div className="p-6">
        <div className="card p-6 bg-red-50 border border-red-200">
          <p className="text-red-700">{error}</p>
          {error.includes('deleted') && <p className="text-sm text-red-600 mt-2">Redirecting to customers list...</p>}
        </div>
      </div>
    );
  }

  if (!customer) return <div className="p-6 text-center">Customer not found</div>;

  const totalDealValue = customer.deals.reduce((sum, d) => sum + (d.dealValue || 0), 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">{customer.companyName}</h1>
        <Link href="/customers" className="btn btn-secondary">Back to Customers</Link>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="col-span-2 space-y-4">
          {/* Company Details */}
          <div className="card p-6">
            <h2 className="text-lg font-bold mb-4">Company Details</h2>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Industry</p>
                <p className="text-lg font-medium">{customer.industry}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Website</p>
                <p className="text-lg font-medium">
                  {customer.website ? (
                    <a href={customer.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {customer.website}
                    </a>
                  ) : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Annual Revenue</p>
                <p className="text-lg font-medium">{formatCurrency(customer.annualRevenue)}</p>
              </div>
            </div>
          </div>

          {/* Contacts */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Contacts ({customer.contacts.length})</h2>
              <button
                onClick={() => {
                  setShowContactForm(!showContactForm);
                  setEditingId(null);
                  setContactForm({ name: '', email: '', phone: '', designation: '', isPrimary: false });
                }}
                className="btn btn-secondary text-sm"
              >
                {showContactForm ? 'Cancel' : '+ Add Contact'}
              </button>
            </div>

            {showContactForm && (
              <div className="mb-6 p-4 bg-blue-50 rounded border border-blue-200 space-y-3">
                <input
                  type="text"
                  placeholder="Full Name *"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
                <input
                  type="email"
                  placeholder="Email *"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
                <input
                  type="tel"
                  placeholder="Phone"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
                <input
                  type="text"
                  placeholder="Designation (e.g. Purchase Manager)"
                  value={contactForm.designation}
                  onChange={(e) => setContactForm({ ...contactForm, designation: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={contactForm.isPrimary}
                    onChange={(e) => setContactForm({ ...contactForm, isPrimary: e.target.checked })}
                  />
                  <span className="text-sm font-medium">Primary Contact</span>
                </label>
                <button onClick={handleAddContact} className="btn btn-primary w-full">
                  {editingId ? 'Update Contact' : 'Add Contact'}
                </button>
              </div>
            )}

            {customer.contacts.length === 0 ? (
              <p className="text-gray-600">No contacts yet</p>
            ) : (
              <div className="space-y-3">
                {customer.contacts.map((contact) => (
                  <div key={contact.id} className="flex items-start gap-4 p-3 bg-gray-50 rounded">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{contact.name}</p>
                        {contact.isPrimary && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Primary</span>}
                      </div>
                      <p className="text-sm text-gray-600">{contact.email}</p>
                      {contact.phone && <p className="text-sm text-gray-600">{contact.phone}</p>}
                      {contact.designation && <p className="text-xs text-gray-500 mt-1">{contact.designation}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditContact(contact)}
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteContact(contact.id)}
                        className="text-red-600 hover:text-red-800 font-medium text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="card p-6">
            <h2 className="text-lg font-bold mb-4">Recent Activity</h2>
            {customer.activityLogs.length === 0 ? (
              <p className="text-gray-600">No activity yet</p>
            ) : (
              <div className="space-y-3">
                {customer.activityLogs.map((log: any) => (
                  <div key={log.id} className="text-sm border-l-2 border-blue-200 pl-4 py-2">
                    <p className="font-medium">{log.action}</p>
                    <p className="text-xs text-gray-500">{new Date(log.createdAt).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Deals Summary */}
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Active Deals</h3>
            <div className="text-3xl font-bold mb-2">{customer.deals.length}</div>
            <p className="text-sm text-gray-600 mb-4">
              {formatCurrency(totalDealValue)}
            </p>
            {customer.deals.length > 0 && (
              <div className="space-y-2 text-xs">
                {customer.deals.map((deal) => (
                  <div key={deal.id} className="p-2 bg-gray-50 rounded">
                    <p className="font-medium">{deal.dealName}</p>
                    <div className="flex justify-between text-gray-500">
                      <span>{deal.stage}</span>
                      {deal.dealValue ? <span>₹{Number(deal.dealValue).toLocaleString('en-IN')}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Created Date */}
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Created</h3>
            <p className="text-sm">
              {new Date(customer.createdAt).toLocaleDateString()}
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Link href={`/customers/${customer.id}/edit`} className="btn btn-primary w-full text-center">
              Edit Customer
            </Link>
            <button className="btn btn-secondary w-full">+ New Deal</button>
          </div>
        </div>
      </div>
    </div>
  );
}
