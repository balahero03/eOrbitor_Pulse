'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Product {
  id: string;
  sku: string;
  name: string;
  category?: string;
  basePrice: string;
  tax: string;
  isActive: boolean;
  inventory?: { quantity: number; reorderLevel?: number };
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    fetchProducts();
  }, [page, category]);

  useEffect(() => {
    extractCategories();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(category && { category }),
        ...(search && { search }),
      });

      const res = await fetch(`/api/products?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch products');

      const data = await res.json();
      setProducts(data.products);
      setPagination(data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const extractCategories = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/products?limit=1000&isActive=true', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const uniqueCategories = [...new Set(data.products.map((p: Product) => p.category).filter(Boolean))].sort() as string[];
        setCategories(uniqueCategories);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchProducts();
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Deactivate this product?')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setProducts(products.filter(p => p.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
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
        <h1 className="text-3xl font-bold">Products</h1>
        <Link href="/products/new" className="btn btn-primary">+ New Product</Link>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6">
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <input
              type="text"
              placeholder="Search by name or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full"
            />
          </div>

          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className="w-full"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <button type="submit" className="btn btn-primary col-span-2">
            Search
          </button>
        </form>
      </div>

      {/* Products Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-gray-600">Loading...</div>
        ) : products.length === 0 ? (
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Base Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Tax %</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Stock</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-sm">{product.sku}</td>
                      <td className="px-6 py-4">
                        <Link href={`/products/${product.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                          {product.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{product.category || '-'}</td>
                      <td className="px-6 py-4 text-sm font-medium">{formatCurrency(product.basePrice)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{product.tax}%</td>
                      <td className="px-6 py-4 text-sm">
                        {product.inventory ? (
                          <span className={product.inventory.quantity === 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                            {product.inventory.quantity} units
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex gap-2">
                          <Link
                            href={`/products/${product.id}`}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => handleDeleteProduct(product.id)}
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
