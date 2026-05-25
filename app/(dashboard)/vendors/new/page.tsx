'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewVendorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    vendorName: '',
    gstNumber: '',
    email: '',
    phone: '',
    website: '',
    paymentTerms: '',
    rating: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!formData.vendorName || !formData.gstNumber) {
        throw new Error('Vendor name and GST number are required');
      }

      const token = localStorage.getItem('token');
      const res = await fetch('/api/vendors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          vendorName: formData.vendorName,
          gstNumber: formData.gstNumber,
          email: formData.email || null,
          phone: formData.phone || null,
          website: formData.website || null,
          paymentTerms: formData.paymentTerms || null,
          rating: formData.rating ? parseInt(formData.rating) : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to create vendor');
      }

      const newVendor = await res.json();
      router.push(`/vendors/${newVendor.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Create New Vendor</h1>
        <Link href="/vendors" className="btn btn-secondary">Back to Vendors</Link>
      </div>

      <div className="card p-8 max-w-2xl">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-1">Vendor Name *</label>
            <input
              type="text"
              name="vendorName"
              value={formData.vendorName}
              onChange={handleChange}
              placeholder="Vendor company name"
              required
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">GST Number *</label>
            <input
              type="text"
              name="gstNumber"
              value={formData.gstNumber}
              onChange={handleChange}
              placeholder="27AABCT1234H1Z0"
              required
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="vendor@company.com"
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+91 9999999999"
                className="w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Website</label>
            <input
              type="url"
              name="website"
              value={formData.website}
              onChange={handleChange}
              placeholder="https://vendor.com"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Payment Terms</label>
            <textarea
              name="paymentTerms"
              value={formData.paymentTerms}
              onChange={handleChange}
              placeholder="Net 30, Net 45, etc."
              className="w-full h-20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Rating (1-5)</label>
            <select
              name="rating"
              value={formData.rating}
              onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
              className="w-full"
            >
              <option value="">No rating</option>
              <option value="1">★ 1 - Poor</option>
              <option value="2">★★ 2 - Fair</option>
              <option value="3">★★★ 3 - Good</option>
              <option value="4">★★★★ 4 - Very Good</option>
              <option value="5">★★★★★ 5 - Excellent</option>
            </select>
          </div>

          <div className="flex gap-4 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary flex-1"
            >
              {loading ? 'Creating...' : 'Create Vendor'}
            </button>
            <Link href="/vendors" className="btn btn-secondary flex-1 text-center">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
