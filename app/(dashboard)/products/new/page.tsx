'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category: '',
    description: '',
    basePrice: '',
    tax: '0',
    initialQuantity: '',
    reorderLevel: '',
    warehouseLocation: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!formData.sku || !formData.name || !formData.basePrice) {
        throw new Error('SKU, name, and base price are required');
      }

      const token = localStorage.getItem('token');
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sku: formData.sku.toUpperCase(),
          name: formData.name,
          category: formData.category || null,
          description: formData.description || null,
          basePrice: parseFloat(formData.basePrice),
          tax: parseFloat(formData.tax) || 0,
          initialQuantity: formData.initialQuantity ? parseInt(formData.initialQuantity) : 0,
          reorderLevel: formData.reorderLevel ? parseInt(formData.reorderLevel) : null,
          warehouseLocation: formData.warehouseLocation || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to create product');
      }

      const newProduct = await res.json();
      router.push(`/products/${newProduct.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Create New Product</h1>
        <Link href="/products" className="btn btn-secondary">Back to Products</Link>
      </div>

      <div className="card p-8 max-w-3xl">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">SKU *</label>
              <input
                type="text"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                placeholder="PROD-001"
                required
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Product Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Product name"
                required
                className="w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <input
              type="text"
              name="category"
              value={formData.category}
              onChange={handleChange}
              placeholder="Electronics, Software, etc."
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Product details..."
              className="w-full h-20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Base Price (INR) *</label>
              <input
                type="number"
                name="basePrice"
                value={formData.basePrice}
                onChange={handleChange}
                placeholder="0"
                step="0.01"
                required
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Tax % (GST)</label>
              <input
                type="number"
                name="tax"
                value={formData.tax}
                onChange={handleChange}
                placeholder="0"
                step="0.01"
                className="w-full"
              />
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Initial Inventory</h3>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Initial Quantity</label>
                <input
                  type="number"
                  name="initialQuantity"
                  value={formData.initialQuantity}
                  onChange={handleChange}
                  placeholder="0"
                  min="0"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Reorder Level</label>
                <input
                  type="number"
                  name="reorderLevel"
                  value={formData.reorderLevel}
                  onChange={handleChange}
                  placeholder="Min quantity for reorder"
                  min="0"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Warehouse Location</label>
                <input
                  type="text"
                  name="warehouseLocation"
                  value={formData.warehouseLocation}
                  onChange={handleChange}
                  placeholder="A1-01, B2-05, etc."
                  className="w-full"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary flex-1"
            >
              {loading ? 'Creating...' : 'Create Product'}
            </button>
            <Link href="/products" className="btn btn-secondary flex-1 text-center">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
