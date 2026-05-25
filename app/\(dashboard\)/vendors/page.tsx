'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Vendor {
  id: string;
  vendorName: string;
  gstNumber: string;
  email?: string;
  phone?: string;
  rating?: number;
  isActive: boolean;
  products: { productId: string }[];
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchVendors();
  }, [page]);

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
      });

      const res = await fetch(`/api/vendors?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch vendors');

      const data = await res.json();
      setVendors(data.vendors);
      setPagination(data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchVendors();
  };

  const handleDeleteVendor = async (id: string) => {
    if (!confirm('Deactivate this vendor?')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/vendors/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setVendors(vendors.filter(v => v.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getRatingColor = (rating?: number) => {
    if (!rating) return 'bg-gray-50 text-gray-700';
    if (rating >= 4) return 'bg-green-50 text-green-700';
    if (rating >= 3) return 'bg-yellow-50 text-yellow-700';
    return 'bg-red-50 text-red-700';
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Vendors</h1>
        <Link href="/vendors/new" className="btn btn-primary">+ New Vendor</Link>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6">
        <form onSubmit={handleSearch} className="flex items-end gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by vendor name, GST, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full"
            />
          </div>

          <button type="submit" className="btn btn-primary">
            Search
          </button>
        </form>
      </div>

      {/* Vendors Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-gray-600">Loading...</div>
        ) : vendors.length === 0 ? (
          <div className="p-6 text-center text-gray-600">No vendors found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Vendor Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">GST Number</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Rating</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Products</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {vendors.map((vendor) => (
                    <tr key={vendor.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium">
                        <Link href={`/vendors/${vendor.id}`} className="text-blue-600 hover:text-blue-800">
                          {vendor.vendorName}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{vendor.gstNumber}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{vendor.email || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{vendor.phone || '-'}</td>
                      <td className="px-6 py-4">
                        {vendor.rating ? (
                          <span className={`badge px-2 py-1 rounded text-xs font-medium ${getRatingColor(vendor.rating)}`}>
                            ★ {vendor.rating}/5
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">{vendor.products?.length || 0}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex gap-2">
                          <Link
                            href={`/vendors/${vendor.id}`}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => handleDeleteVendor(vendor.id)}
                            className="text-red-600 hover:text-red-800 font-medium"
                          >
                            Deactivate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
              <div className="p-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {(page - 1) * pagination.limit + 1} to{' '}
                  {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="btn btn-secondary disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2">{page} of {pagination.pages}</span>
                  <button
                    onClick={() => setPage(Math.min(pagination.pages, page + 1))}
                    disabled={page === pagination.pages}
                    className="btn btn-secondary disabled:opacity-50"
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
