'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface InventoryItem {
  id: string;
  product: { id: string; sku: string; name: string; basePrice: string; category?: string };
  quantity: number;
  reorderLevel?: number;
  warehouseLocation?: string;
  lastRestockDate?: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchInventory();
  }, [page, lowStockOnly]);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(lowStockOnly && { lowStockOnly: 'true' }),
        ...(search && { search }),
      });

      const res = await fetch(`/api/inventory?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch inventory');

      const data = await res.json();
      setInventory(data.inventory);
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
    fetchInventory();
  };

  const isLowStock = (quantity: number, reorderLevel?: number) => {
    return reorderLevel && quantity <= reorderLevel;
  };

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(parseFloat(value));
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Inventory</h1>
        <Link href="/products/new" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">+ New Product</Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
        <form onSubmit={handleSearch} className="flex items-end gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by product name or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => {
                setLowStockOnly(e.target.checked);
                setPage(1);
              }}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium">Low Stock Only</span>
          </label>

          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
            Search
          </button>
        </form>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-gray-600">Loading...</div>
        ) : inventory.length === 0 ? (
          <div className="p-6 text-center text-gray-600">No products found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">SKU</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Product Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Quantity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Reorder Level</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Unit Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Warehouse</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {inventory.map((item) => (
                    <tr
                      key={item.id}
                      className={isLowStock(item.quantity, item.reorderLevel) ? 'bg-red-50' : 'hover:bg-gray-50'}
                    >
                      <td className="px-6 py-4 font-medium text-sm">{item.product.sku}</td>
                      <td className="px-6 py-4">
                        <Link href={`/products/${item.product.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                          {item.product.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{item.product.category || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`font-bold text-lg ${isLowStock(item.quantity, item.reorderLevel) ? 'text-red-600' : 'text-green-600'}`}>
                          {item.quantity}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{item.reorderLevel || '-'}</td>
                      <td className="px-6 py-4">
                        {isLowStock(item.quantity, item.reorderLevel) ? (
                          <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-medium">
                            LOW STOCK
                          </span>
                        ) : item.quantity === 0 ? (
                          <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-medium">
                            OUT OF STOCK
                          </span>
                        ) : (
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                            IN STOCK
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">{formatCurrency(item.product.basePrice)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{item.warehouseLocation || '-'}</td>
                      <td className="px-6 py-4 text-sm">
                        <Link
                          href={`/products/${item.product.id}`}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View
                        </Link>
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
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2">{page} of {pagination.pages}</span>
                  <button
                    onClick={() => setPage(Math.min(pagination.pages, page + 1))}
                    disabled={page === pagination.pages}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40"
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
