'use client';

import { useState, useEffect } from 'react';
import { SOLUTION_AREAS, OEM_LIST } from '@/lib/eorbitor-constants';
import { ProductIcon } from '@/components/icons';

interface Product {
  id: string;
  sku: string;
  name: string;
  category?: string;
  oemName?: string;
  description?: string;
  basePrice: string;
  tax: string;
  isActive: boolean;
  inventory?: { quantity: number; reorderLevel?: number; warehouseLocation?: string };
  attributes?: Record<string, string>;
}

interface ProductForm {
  sku: string;
  name: string;
  category: string;
  oemName: string;
  description: string;
  basePrice: string;
  tax: string;
  initialQuantity: string;
  reorderLevel: string;
  warehouseLocation: string;
  attributes: { key: string; value: string }[];
}

const emptyForm = (): ProductForm => ({
  sku: '', name: '', category: '', oemName: '', description: '',
  basePrice: '', tax: '18',
  initialQuantity: '0', reorderLevel: '', warehouseLocation: '',
  attributes: [],
});

const fmt = (v: string | number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(v));

// ─── Product Form Modal ───────────────────────────────────────────────────────
function ProductModal({
  initial, onSave, onClose, saving, error,
}: {
  initial: ProductForm;
  onSave: (form: ProductForm) => void;
  onClose: () => void;
  saving: boolean;
  error: string;
}) {
  const [form, setForm] = useState<ProductForm>(initial);
  const set = (k: keyof ProductForm, v: any) => setForm(f => ({ ...f, [k]: v }));
  const isEdit = !!initial.sku;

  const addAttr = () => setForm(f => ({ ...f, attributes: [...f.attributes, { key: '', value: '' }] }));
  const updateAttr = (i: number, field: 'key' | 'value', v: string) =>
    setForm(f => ({ ...f, attributes: f.attributes.map((a, idx) => idx === i ? { ...a, [field]: v } : a) }));
  const removeAttr = (i: number) =>
    setForm(f => ({ ...f, attributes: f.attributes.filter((_, idx) => idx !== i) }));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Edit Product' : 'Add Product'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                SKU <span className="text-red-500">*</span>
              </label>
              <input type="text" value={form.sku} onChange={e => set('sku', e.target.value)}
                placeholder="e.g. PRD-001" disabled={isEdit}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50 disabled:text-gray-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                <option value="">Select Solution Area</option>
                {SOLUTION_AREAS.map(sa => (
                  <option key={sa.id} value={sa.id}>{sa.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">OEM Partner</label>
              <select value={form.oemName} onChange={e => set('oemName', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                <option value="">Select OEM (Optional)</option>
                {OEM_LIST.map(oem => (
                  <option key={oem} value={oem}>{oem}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                Product Name <span className="text-red-500">*</span>
              </label>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="Full product name"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Description</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                rows={2} placeholder="Specs, model info, details…"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
          </div>

          {/* Pricing */}
          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Pricing</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Unit Price (₹) <span className="text-red-500">*</span>
                </label>
                <input type="number" value={form.basePrice} onChange={e => set('basePrice', e.target.value)}
                  placeholder="0.00" min="0" step="0.01"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">GST / Tax %</label>
                <div className="flex gap-2">
                  {[0, 5, 12, 18, 28].map(rate => (
                    <button key={rate} type="button"
                      onClick={() => set('tax', String(rate))}
                      className={`flex-1 py-2 text-xs rounded-lg border font-medium transition-colors ${String(form.tax) === String(rate)
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-200 text-gray-600 hover:border-blue-300'
                        }`}>
                      {rate}%
                    </button>
                  ))}
                  <input type="number" value={form.tax} onChange={e => set('tax', e.target.value)}
                    min="0" max="100" step="0.5" placeholder="Custom"
                    className="w-20 border rounded-lg px-2 py-2 text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-200" />
                </div>
              </div>
            </div>
            {form.basePrice && (
              <div className="mt-2 p-2 bg-gray-50 rounded-lg flex gap-6 text-xs text-gray-500">
                <span>Base: <strong>{fmt(Number(form.basePrice))}</strong></span>
                <span>Tax: <strong>{fmt(Number(form.basePrice) * (Number(form.tax) / 100))}</strong></span>
                <span className="text-green-700 font-bold">
                  Total: {fmt(Number(form.basePrice) * (1 + Number(form.tax) / 100))}
                </span>
              </div>
            )}
          </div>

          {/* Inventory — only on create */}
          {!isEdit && (
            <div className="border-t pt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Inventory</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Opening Qty</label>
                  <input type="number" value={form.initialQuantity} onChange={e => set('initialQuantity', e.target.value)}
                    min="0"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Reorder Level</label>
                  <input type="number" value={form.reorderLevel} onChange={e => set('reorderLevel', e.target.value)}
                    min="0" placeholder="e.g. 5"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Location</label>
                  <input type="text" value={form.warehouseLocation} onChange={e => set('warehouseLocation', e.target.value)}
                    placeholder="e.g. Shelf A3"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                </div>
              </div>
            </div>
          )}

          {/* Extra Attributes */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase">Additional Features / Specs</p>
              <button type="button" onClick={addAttr}
                className="text-xs px-3 py-1.5 border border-dashed border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
                + Add Feature
              </button>
            </div>
            {form.attributes.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3 border border-dashed rounded-lg">
                No extra features yet. Add brand, model, warranty, colour, etc.
              </p>
            ) : (
              <div className="space-y-2">
                {form.attributes.map((attr, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input type="text" value={attr.key} onChange={e => updateAttr(i, 'key', e.target.value)}
                      placeholder="Feature name (e.g. Brand)"
                      className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                    <input type="text" value={attr.value} onChange={e => updateAttr(i, 'value', e.target.value)}
                      placeholder="Value (e.g. HP)"
                      className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                    <button type="button" onClick={() => removeAttr(i)}
                      className="text-gray-300 hover:text-red-500 text-2xl leading-none">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-6 py-4 flex gap-3 flex-shrink-0">
          <button onClick={onClose} disabled={saving}
            className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={() => onSave(form)} disabled={saving || !form.name.trim() || !form.sku.trim() || !form.basePrice}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Product'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Products Page ───────────────────────────────────────────────────────
export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [userRole, setUserRole] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(u => setUserRole(u.role)).catch(() => { });
    fetchCategories();
  }, []);

  useEffect(() => { fetchProducts(); }, [page, categoryFilter]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: String(page), limit: '25',
        ...(categoryFilter && { category: categoryFilter }),
        ...(search && { search }),
      });
      const res = await fetch(`/api/products?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProducts(data.products);
      setPagination(data.pagination);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/products?limit=500', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const cats = [...new Set(data.products.map((p: Product) => p.category).filter(Boolean))].sort() as string[];
        setCategories(cats);
      }
    } catch { /* silent */ }
  };

  const canManage = ['SUPER_ADMIN', 'ADMIN'].includes(userRole);

  const openAdd = () => { setEditProduct(null); setModalError(''); setShowModal(true); };
  const openEdit = (p: Product) => { setEditProduct(p); setModalError(''); setShowModal(true); };

  const handleSave = async (form: ProductForm) => {
    setSaving(true);
    setModalError('');
    try {
      const token = localStorage.getItem('token');
      const attrs = form.attributes.filter(a => a.key.trim())
        .reduce((acc, a) => ({ ...acc, [a.key.trim()]: a.value }), {});

      if (editProduct) {
        const res = await fetch(`/api/products/${editProduct.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: form.name, category: form.category || null, oemName: form.oemName || null,
            description: form.description || null,
            basePrice: form.basePrice, tax: form.tax,
            ...(Object.keys(attrs).length && { attributes: attrs }),
          }),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Failed to update'); }
        const updated = await res.json();
        setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
      } else {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            sku: form.sku, name: form.name,
            category: form.category || null, oemName: form.oemName || null,
            description: form.description || null,
            basePrice: form.basePrice, tax: form.tax,
            initialQuantity: form.initialQuantity,
            reorderLevel: form.reorderLevel || undefined,
            warehouseLocation: form.warehouseLocation || undefined,
            ...(Object.keys(attrs).length && { attributes: attrs }),
          }),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Failed to create'); }
        await fetchProducts();
        await fetchCategories();
      }
      setShowModal(false);
    } catch (err: any) {
      setModalError(err.message || 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/products/${deleteId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      setProducts(prev => prev.filter(p => p.id !== deleteId));
    } catch { /* silent */ }
    finally { setDeleting(false); setDeleteId(null); }
  };

  const formFromProduct = (p: Product): ProductForm => ({
    sku: p.sku, name: p.name,
    category: p.category || '', oemName: p.oemName || '', description: p.description || '',
    basePrice: String(p.basePrice), tax: String(p.tax),
    initialQuantity: '0',
    reorderLevel: String(p.inventory?.reorderLevel || ''),
    warehouseLocation: p.inventory?.warehouseLocation || '',
    attributes: p.attributes
      ? Object.entries(p.attributes).map(([key, value]) => ({ key, value: String(value) }))
      : [],
  });

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500">Product catalog &amp; inventory</p>
        </div>
        {canManage && (
          <button onClick={openAdd}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-sm">
            + Add Product
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchProducts()}
            placeholder="Product name or SKU…"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>
        {categories.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
            <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
              <option value="">All Categories</option>
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        )}
        <button onClick={() => { setPage(1); fetchProducts(); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          Search
        </button>
        {(search || categoryFilter) && (
          <button onClick={() => { setSearch(''); setCategoryFilter(''); }}
            className="px-3 py-2 text-sm text-gray-500 border rounded-lg hover:bg-gray-50">
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <ProductIcon className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">No products found</p>
            {canManage && (
              <button onClick={openAdd} className="mt-3 text-sm text-blue-600 hover:underline">
                + Add your first product
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-12">Sr.</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">SKU</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Description / Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Category / OEM</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Unit Price</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">GST %</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Price + Tax</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stock</th>
                    {canManage && <th className="px-4 py-3 w-24"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {products.map((p, idx) => {
                    const unitPrice = Number(p.basePrice);
                    const taxAmt = unitPrice * (Number(p.tax) / 100);
                    const withTax = unitPrice + taxAmt;
                    const stock = p.inventory?.quantity ?? 0;
                    const lowStock = !!(p.inventory?.reorderLevel && stock <= p.inventory.reorderLevel);

                    return (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3.5 text-center text-gray-400 text-xs font-medium">
                          {(page - 1) * 25 + idx + 1}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs text-gray-500">{p.sku}</td>
                        <td className="px-4 py-3.5 max-w-xs">
                          <p className="font-semibold text-gray-900">{p.name}</p>
                          {p.description && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">{p.description}</p>
                          )}
                          {p.attributes && Object.keys(p.attributes).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Object.entries(p.attributes).slice(0, 4).map(([k, v]) => (
                                <span key={k} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-100">
                                  {k}: {String(v)}
                                </span>
                              ))}
                              {Object.keys(p.attributes).length > 4 && (
                                <span className="text-[10px] text-gray-400">+{Object.keys(p.attributes).length - 4} more</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-gray-500 text-xs">
                          <div className="space-y-1">
                            {p.category && (
                              <div className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded inline-block border border-blue-100">
                                {p.category}
                              </div>
                            )}
                            {p.oemName && (
                              <div className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded inline-block border border-purple-100 ml-1">
                                {p.oemName}
                              </div>
                            )}
                            {!p.category && !p.oemName && <span className="text-gray-300">—</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-gray-800">{fmt(unitPrice)}</td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium border border-blue-100">
                            {p.tax}%
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-gray-900">{fmt(withTax)}</td>
                        <td className="px-4 py-3.5 text-center">
                          {p.inventory ? (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${stock === 0
                                ? 'bg-red-100 text-red-600 border-red-200'
                                : lowStock
                                  ? 'bg-amber-100 text-amber-700 border-amber-200'
                                  : 'bg-green-100 text-green-700 border-green-200'
                              }`}>
                              {stock === 0 ? 'Out' : `${stock}`}
                            </span>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        {canManage && (
                          <td className="px-4 py-3.5">
                            <div className="flex gap-3 justify-end">
                              <button onClick={() => openEdit(p)}
                                className="text-xs text-blue-600 hover:underline font-medium">Edit</button>
                              <button onClick={() => setDeleteId(p.id)}
                                className="text-xs text-red-500 hover:underline font-medium">Delete</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {pagination && pagination.pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  {pagination.total} products · page {pagination.page} of {pagination.pages}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => p - 1)} disabled={page === 1}
                    className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50">← Prev</button>
                  <button onClick={() => setPage(p => p + 1)} disabled={page >= pagination.pages}
                    className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50">Next →</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <ProductModal
          initial={editProduct ? formFromProduct(editProduct) : emptyForm()}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
          saving={saving}
          error={modalError}
        />
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-bold text-red-600 mb-2">Deactivate Product?</h2>
            <p className="text-sm text-gray-600 mb-5">
              This product will be marked inactive and hidden from the catalog. Existing quotations are unaffected.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} disabled={deleting}
                className="flex-1 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                {deleting ? 'Deactivating…' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
