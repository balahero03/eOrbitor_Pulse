'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface VendorProduct {
  vendorId: string;
  vendor: { id: string; vendorName: string; rating?: number };
  vendorSku: string;
  vendorPrice: string;
  leadTime?: number;
  minimumOrder?: number;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  category?: string;
  description?: string;
  basePrice: string;
  tax: string;
  isActive: boolean;
  createdAt: string;
  inventory?: { quantity: number; reorderLevel?: number; warehouseLocation?: string; lastRestockDate?: string };
  vendorProducts?: VendorProduct[];
}

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    basePrice: '',
    tax: '',
  });

  useEffect(() => {
    fetchProduct();
  }, [params.id]);

  const fetchProduct = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/products/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch product');

      const data = await res.json();
      setProduct(data);
      setFormData({
        name: data.name,
        category: data.category || '',
        description: data.description || '',
        basePrice: data.basePrice,
        tax: data.tax,
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
      const res = await fetch(`/api/products/${params.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name,
          category: formData.category,
          description: formData.description,
          basePrice: formData.basePrice,
          tax: formData.tax,
        }),
      });

      if (!res.ok) throw new Error('Failed to update product');

      const updated = await res.json();
      setProduct(updated);
      setEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!confirm('Deactivate this product?')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/products/${params.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        router.push('/products');
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
  if (!product) return <div className="p-6 text-center">Product not found</div>;

  const stockStatus = product.inventory
    ? product.inventory.quantity === 0
      ? 'OUT_OF_STOCK'
      : product.inventory.reorderLevel && product.inventory.quantity <= product.inventory.reorderLevel
      ? 'LOW_STOCK'
      : 'IN_STOCK'
    : 'NO_INVENTORY';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">{product.name}</h1>
        <Link href="/products" className="btn btn-secondary">Back to Products</Link>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2 space-y-4">
          {/* Product Info */}
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
                  <label className="block text-sm font-medium mb-1">Product Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full h-20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Base Price</label>
                    <input
                      type="number"
                      value={formData.basePrice}
                      onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                      step="0.01"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Tax %</label>
                    <input
                      type="number"
                      value={formData.tax}
                      onChange={(e) => setFormData({ ...formData, tax: e.target.value })}
                      step="0.01"
                      className="w-full"
                    />
                  </div>
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
                  <p className="text-xs text-gray-500 uppercase font-semibold mb-1">SKU</p>
                  <p className="text-lg font-medium">{product.sku}</p>
                </div>

                {product.category && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Category</p>
                    <p className="text-lg font-medium">{product.category}</p>
                  </div>
                )}

                {product.description && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Description</p>
                    <p className="text-gray-700">{product.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Base Price</p>
                    <p className="text-lg font-medium">{formatCurrency(product.basePrice)}</p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Tax Rate</p>
                    <p className="text-lg font-medium">{product.tax}%</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Vendors */}
          {product.vendorProducts && product.vendorProducts.length > 0 && (
            <div className="card p-6">
              <h2 className="text-lg font-bold mb-4">Vendors & Pricing</h2>
              <div className="space-y-3">
                {product.vendorProducts.map((vp) => (
                  <div key={vp.vendorId} className="border border-gray-200 rounded p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium">{vp.vendor.vendorName}</p>
                        <p className="text-xs text-gray-500">Rating: {vp.vendor.rating || 'N/A'}/5</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Vendor SKU</p>
                        <p className="font-medium">{vp.vendorSku}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Price</p>
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
          {/* Inventory Status */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-3">Stock Status</h3>
            {product.inventory ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Quantity</p>
                  <p className="text-3xl font-bold text-green-600">{product.inventory.quantity}</p>
                </div>

                {product.inventory.reorderLevel && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Reorder Level</p>
                    <p className="text-lg font-medium">{product.inventory.reorderLevel}</p>
                  </div>
                )}

                {product.inventory.warehouseLocation && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Warehouse</p>
                    <p className="text-lg font-medium">{product.inventory.warehouseLocation}</p>
                  </div>
                )}

                <div className="pt-3 border-t">
                  <span className={`badge px-3 py-1 rounded font-medium ${
                    stockStatus === 'IN_STOCK' ? 'bg-green-100 text-green-800' :
                    stockStatus === 'LOW_STOCK' ? 'bg-orange-100 text-orange-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {stockStatus === 'IN_STOCK' ? 'In Stock' : stockStatus === 'LOW_STOCK' ? 'Low Stock' : 'Out of Stock'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">No inventory data</p>
            )}
          </div>

          {/* Meta */}
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Details</h3>
            <div className="space-y-2 text-xs text-gray-600">
              <p>
                <span className="font-medium">Created:</span>
                <br />
                {new Date(product.createdAt).toLocaleDateString()}
              </p>
              <p>
                <span className="font-medium">Status:</span>
                <br />
                {product.isActive ? 'Active' : 'Inactive'}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="card p-6">
            <button
              onClick={handleDeleteProduct}
              className="btn btn-danger w-full"
            >
              Deactivate Product
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
