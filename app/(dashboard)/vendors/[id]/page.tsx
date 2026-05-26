'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface VendorProduct {
  vendor: { id: string };
  product: { id: string; sku: string; name: string; basePrice: string };
  vendorSku: string;
  vendorPrice: string;
  leadTime?: number;
  minimumOrder?: number;
}

interface Vendor {
  id: string;
  vendorName: string;
  gstNumber: string;
  email?: string;
  phone?: string;
  website?: string;
  paymentTerms?: string;
  rating?: number;
  isActive: boolean;
  createdAt: string;
  products: VendorProduct[];
}

export default function VendorDetailPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    vendorName: '',
    email: '',
    phone: '',
    website: '',
    paymentTerms: '',
    rating: '',
  });

  useEffect(() => {
    fetchVendor();
  }, [id]);

  const fetchVendor = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/vendors/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch vendor');

      const data = await res.json();
      setVendor(data);
      setFormData({
        vendorName: data.vendorName,
        email: data.email || '',
        phone: data.phone || '',
        website: data.website || '',
        paymentTerms: data.paymentTerms || '',
        rating: data.rating?.toString() || '',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/vendors/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          vendorName: formData.vendorName,
          email: formData.email || null,
          phone: formData.phone || null,
          website: formData.website || null,
          paymentTerms: formData.paymentTerms || null,
          rating: formData.rating ? parseInt(formData.rating) : null,
        }),
      });

      if (!res.ok) throw new Error('Failed to update vendor');

      const updated = await res.json();
      setVendor(updated);
      setEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVendor = async () => {
    if (!confirm('Deactivate this vendor?')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/vendors/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        router.push('/vendors');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatCurrency = (value: string | number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(parseFloat(value.toString()));
  };

  if (loading) return <div className="p-6 text-center">Loading...</div>;
  if (!vendor) return <div className="p-6 text-center">Vendor not found</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">{vendor.vendorName}</h1>
        <Link href="/vendors" className="btn btn-secondary">Back to Vendors</Link>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-4">
          {/* Vendor Info */}
          <div className="card p-6">
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="btn btn-secondary mb-4"
              >
                Edit
              </button>
            )}

            {editing ? (
              <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Vendor Name *</label>
                  <input
                    type="text"
                    value={formData.vendorName}
                    onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                    className="w-full"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Website</label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Payment Terms</label>
                  <textarea
                    value={formData.paymentTerms}
                    onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                    className="w-full h-20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Rating (1-5)</label>
                  <select
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

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn btn-primary"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold mb-1">GST Number</p>
                  <p className="text-lg font-medium">{vendor.gstNumber}</p>
                </div>

                {vendor.email && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Email</p>
                    <p className="text-lg font-medium"><a href={`mailto:${vendor.email}`} className="text-blue-600 hover:text-blue-800">{vendor.email}</a></p>
                  </div>
                )}

                {vendor.phone && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Phone</p>
                    <p className="text-lg font-medium"><a href={`tel:${vendor.phone}`} className="text-blue-600 hover:text-blue-800">{vendor.phone}</a></p>
                  </div>
                )}

                {vendor.website && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Website</p>
                    <p className="text-lg font-medium"><a href={vendor.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">{vendor.website}</a></p>
                  </div>
                )}

                {vendor.paymentTerms && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Payment Terms</p>
                    <p className="text-gray-700">{vendor.paymentTerms}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Vendor Products */}
          {vendor.products && vendor.products.length > 0 && (
            <div className="card p-6">
              <h2 className="text-lg font-bold mb-4">Products ({vendor.products.length})</h2>
              <div className="space-y-3">
                {vendor.products.map((vp) => (
                  <div key={vp.product.id} className="border border-gray-200 rounded p-3">
                    <div className="flex items-start justify-between mb-2">
                      <Link
                        href={`/products/${vp.product.id}`}
                        className="font-medium text-blue-600 hover:text-blue-800"
                      >
                        {vp.product.name}
                      </Link>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">SKU</p>
                        <p className="font-medium">{vp.product.sku}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Vendor SKU</p>
                        <p className="font-medium">{vp.vendorSku}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Vendor Price</p>
                        <p className="font-medium">{formatCurrency(vp.vendorPrice)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Lead Time</p>
                        <p className="font-medium">{vp.leadTime ? `${vp.leadTime} days` : 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Rating */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-3">Rating</h3>
            {vendor.rating ? (
              <div className="text-center">
                <p className="text-4xl font-bold text-yellow-500">★ {vendor.rating}</p>
                <p className="text-sm text-gray-600 mt-2">out of 5</p>
              </div>
            ) : (
              <p className="text-gray-500 text-center">No rating</p>
            )}
          </div>

          {/* Meta */}
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Details</h3>
            <div className="space-y-2 text-xs text-gray-600">
              <p>
                <span className="font-medium">Created:</span>
                <br />
                {new Date(vendor.createdAt).toLocaleDateString()}
              </p>
              <p>
                <span className="font-medium">Status:</span>
                <br />
                {vendor.isActive ? 'Active' : 'Inactive'}
              </p>
              <p>
                <span className="font-medium">Products:</span>
                <br />
                {vendor.products?.length || 0}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="card p-6">
            <button
              onClick={handleDeleteVendor}
              className="btn btn-danger w-full"
            >
              Deactivate Vendor
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
