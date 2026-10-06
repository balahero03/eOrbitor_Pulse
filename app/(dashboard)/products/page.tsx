'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDelayedFlag } from '@/lib/hooks/useDelayedFlag';
import { useMountTransition } from '@/lib/hooks/useMountTransition';
import { toFiniteNumber } from '@/lib/money';
import { SOLUTION_AREAS, OEM_LIST } from '@/lib/eorbitor-constants';
import { ProductIcon } from '@/components/icons';
import LiveSearchDropdown, { highlightMatch } from '@/components/LiveSearchDropdown';
import PageContainer from '@/components/PageContainer';
import { buttonClasses } from '@/components/Button';
import FilterPanel from '@/components/FilterPanel';
import NumberField from '@/components/NumberField';
import { InlineLoader } from '@/components/BrandedLoader';
import { useToast } from '@/components/Toast';

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
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(toFiniteNumber(v));

// ─── Product Form Modal ───────────────────────────────────────────────────────
function ProductModal({
  initial, onSave, onClose, saving, error, leaving,
}: {
  initial: ProductForm;
  onSave: (form: ProductForm, asNew?: boolean) => void;
  onClose: () => void;
  saving: boolean;
  error: string;
  /** True during the close animation. The parent keeps this component mounted
      until the animation finishes, then unmounts it for real — which is what
      lets a later "Edit" open with fresh state instead of reusing whatever
      this instance's form state was left at. */
  leaving: boolean;
}) {
  const [form, setForm] = useState<ProductForm>(initial);
  const set = (k: keyof ProductForm, v: any) => setForm(f => ({ ...f, [k]: v }));
  const isEdit = !!initial.sku;
  const [skuEditable, setSkuEditable] = useState(false);
  const [showSaveAsNewPrompt, setShowSaveAsNewPrompt] = useState(false);
  const [newSku, setNewSku] = useState(initial.sku ? `${initial.sku}-COPY` : '');

  const addAttr = () => setForm(f => ({ ...f, attributes: [...f.attributes, { key: '', value: '' }] }));
  const updateAttr = (i: number, field: 'key' | 'value', v: string) =>
    setForm(f => ({ ...f, attributes: f.attributes.map((a, idx) => idx === i ? { ...a, [field]: v } : a) }));
  const removeAttr = (i: number) =>
    setForm(f => ({ ...f, attributes: f.attributes.filter((_, idx) => idx !== i) }));

  return (
    <div className={`fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 ${leaving ? 'animate-fade-out' : 'animate-fade-in'}`}>
      <div className={`bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90dvh] sm:max-h-[90vh] flex flex-col ${leaving ? 'animate-slide-down sm:animate-scale-out' : 'animate-slide-up sm:animate-scale-in'}`}>
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

          {/* Save as New Product Inline Prompt */}
          {showSaveAsNewPrompt && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                  Save as New Product (Copy)
                </p>
                <button type="button" onClick={() => setShowSaveAsNewPrompt(false)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
              </div>
              <p className="text-xs text-emerald-800">
                Specify a unique SKU for this new product copy. The original product <strong>{initial.sku}</strong> will remain unchanged.
              </p>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={newSku}
                  onChange={e => setNewSku(e.target.value.toUpperCase())}
                  placeholder="e.g. PRD-002"
                  className="flex-1 border border-emerald-300 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newSku.trim()) return;
                    onSave({ ...form, sku: newSku.trim() }, true);
                  }}
                  disabled={saving || !newSku.trim()}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {saving ? 'Creating…' : 'Confirm & Save Copy'}
                </button>
              </div>
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase">
                  SKU <span className="text-red-500">*</span>
                </label>
                {isEdit && !skuEditable && (
                  <button
                    type="button"
                    onClick={() => {
                      setSkuEditable(true);
                      if (form.sku === initial.sku) set('sku', `${initial.sku}-COPY`);
                    }}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium underline"
                  >
                    Edit SKU (save as copy)
                  </button>
                )}
              </div>
              <input type="text" value={form.sku} onChange={e => set('sku', e.target.value.toUpperCase())}
                placeholder="e.g. PRD-001" disabled={isEdit && !skuEditable}
                className="w-full border rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50 disabled:text-gray-400" />
              {isEdit && skuEditable && form.sku !== initial.sku && (
                <p className="text-[11px] text-emerald-600 mt-1">✓ Modified SKU will be saved as a new product copy</p>
              )}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                  Unit Price <span className="text-red-500">*</span>
                </label>
                <NumberField prefix="₹" value={form.basePrice} onChange={v => set('basePrice', v)}
                  placeholder="0.00" min="0" step="0.01" />
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
                  <NumberField value={form.tax} onChange={v => set('tax', v)}
                    min="0" max="100" step="0.5" placeholder="Custom"
                    wrapperClassName="w-20" className="text-xs text-center" />
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Opening Qty</label>
                  <NumberField value={form.initialQuantity} onChange={v => set('initialQuantity', v)}
                    min="0" placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Reorder Level</label>
                  <NumberField value={form.reorderLevel} onChange={v => set('reorderLevel', v)}
                    min="0" placeholder="e.g. 5" />
                </div>
                <div className="col-span-2 sm:col-span-1">
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
                className="min-h-[36px] sm:min-h-0 text-xs px-3 py-1.5 border border-dashed border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors inline-flex items-center justify-center whitespace-nowrap">
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
        <div className="border-t border-gray-100 px-6 py-4 flex flex-wrap gap-2.5 sm:gap-3 flex-shrink-0 items-center">
          <button type="button" onClick={onClose} disabled={saving}
            className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          {isEdit && (
            <button
              type="button"
              onClick={() => {
                if (form.sku !== initial.sku && form.sku.trim()) {
                  onSave(form, true);
                } else {
                  setShowSaveAsNewPrompt(true);
                }
              }}
              disabled={saving || !form.name.trim() || !form.basePrice}
              title="Duplicate and save this edited product under a new SKU"
              className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
              <span>Save as New Product</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onSave(form, false)}
            disabled={saving || !form.name.trim() || !form.sku.trim() || !form.basePrice}
            className={buttonClasses({ size: 'lg', className: 'flex-1 min-w-[140px]' })}
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Product'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Products Page ───────────────────────────────────────────────────────
export default function ProductsPage() {
  const router = useRouter();
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // `loading` gates only the first paint; `refreshing` covers every later
  // fetch so a category filter change dims the current rows instead of
  // replacing them with a spinner.
  const [refreshing, setRefreshing] = useState(false);
  // Only actually dims the list once the fetch has been running for 150ms —
  // see lib/hooks/useDelayedFlag.ts. Without this, a fast API response
  // reverses the opacity transition before it ever finishes animating, which
  // reads as a one-frame flicker rather than a fade.
  const showRefreshing = useDelayedFlag(refreshing);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [userRole, setUserRole] = useState('');

  const [showModal, setShowModal] = useState(false);
  // ProductModal is a separate component that fully remounts on reopen (its
  // form state resets from `initial` only on mount), so the exit hook lives
  // here and is threaded in as a `leaving` prop rather than used inside the
  // modal itself — that keeps the "fresh form every open" behaviour intact
  // while still animating the close.
  const { mounted: addEditModalMounted, leaving: addEditModalLeaving } = useMountTransition(showModal);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { mounted: deleteModalMounted, leaving: deleteModalLeaving } = useMountTransition(!!deleteId);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(u => setUserRole(u.role)).catch(() => { });
    fetchCategories();
  }, []);

  useEffect(() => { fetchProducts(); }, [page, categoryFilter]);

  const fetchProducts = async () => {
    setRefreshing(true);
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
    finally { setLoading(false); setRefreshing(false); }
  };

  const fetchProductSuggestions = useCallback(async (query: string): Promise<Product[]> => {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({ search: query, page: '1', limit: '8' });
    const res = await fetch(`/api/products?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Search failed');
    const data = await res.json();
    return (data.products || []) as Product[];
  }, []);

  const renderProductSuggestion = (p: Product, query: string) => (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-900 truncate">{highlightMatch(p.name, query)}</span>
        <span className="flex-shrink-0 text-xs font-semibold text-gray-700">{fmt(p.basePrice)}</span>
      </div>
      <p className="text-xs text-gray-500 mt-0.5 truncate">
        {highlightMatch(p.sku, query)}
        {p.oemName ? <> · {highlightMatch(p.oemName, query)}</> : null}
      </p>
    </div>
  );

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

  const handleSave = async (form: ProductForm, asNew?: boolean) => {
    setSaving(true);
    setModalError('');
    try {
      const token = localStorage.getItem('token');
      const attrs = form.attributes.filter(a => a.key.trim())
        .reduce((acc, a) => ({ ...acc, [a.key.trim()]: a.value }), {});

      if (editProduct && !asNew) {
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
        toast.success(`Product updated: ${form.name}`);
      } else {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            sku: form.sku, name: form.name,
            category: form.category || null, oemName: form.oemName || null,
            description: form.description || null,
            basePrice: form.basePrice, tax: form.tax,
            initialQuantity: form.initialQuantity || '0',
            reorderLevel: form.reorderLevel || undefined,
            warehouseLocation: form.warehouseLocation || undefined,
            ...(Object.keys(attrs).length && { attributes: attrs }),
          }),
        });
        if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Failed to create'); }
        const created = await res.json();
        await fetchProducts();
        await fetchCategories();
        toast.success(asNew ? `Saved as new product: ${created.name} (${created.sku})` : `Product created: ${created.name}`);
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
    <PageContainer>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Product catalog &amp; inventory</p>
        </div>
        {canManage && (
          <button onClick={openAdd}
            className="px-3.5 sm:px-4 py-2 bg-blue-600 text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm text-center w-full sm:w-auto">
            + Add Product
          </button>
        )}
      </div>

      {/* Category quick-filter chips */}
      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pt-2 pb-2 px-1 -mx-1 whitespace-nowrap mb-4 scrollbar-none max-w-full">
          <button
            onClick={() => { setCategoryFilter(''); setPage(1); }}
            className={`filter-pill px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 ease-out ${!categoryFilter
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm scale-[1.02] ring-2 ring-blue-400/40'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50/80 hover:text-gray-900'
              }`}
          >
            All Products
          </button>
          {categories.map(c => (
            <button
              key={c}
              onClick={() => {
                const next = categoryFilter === c ? '' : c;
                setCategoryFilter(next);
                setPage(1);
              }}
              className={`filter-pill px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 ease-out ${categoryFilter === c
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm scale-[1.02] ring-2 ring-blue-400/40'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50/80 hover:text-gray-900'
                }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Search bar + filter toggle (Leads-style) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3.5 sm:p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-stretch sm:items-center">
          <LiveSearchDropdown<Product>
            value={search}
            onChange={setSearch}
            onSearch={() => { setPage(1); fetchProducts(); }}
            fetchSuggestions={fetchProductSuggestions}
            getKey={(p) => p.id}
            getHref={(p) => `/products/${p.id}`}
            renderItem={renderProductSuggestion}
            placeholder="Search by product name, SKU, OEM partner, category..."
            ariaLabel="Search products"
            cacheKeyPrefix="products"
            className="w-full sm:flex-1 min-w-0"
          />
          <div className="flex items-center gap-2 flex-shrink-0 justify-end">
            {categories.length > 0 && (
              <button
                type="button"
                onClick={() => setShowFilters(f => !f)}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs sm:text-sm font-semibold transition-colors ${showFilters || categoryFilter
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                  }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                </svg>
                Filters
                {categoryFilter && (
                  <span className="bg-white text-blue-600 rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold ml-0.5">
                    1
                  </span>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => { setPage(1); fetchProducts(); }}
              className="flex-1 sm:flex-initial px-4 py-2 bg-blue-600 text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm text-center"
            >
              Search
            </button>
            {(search || categoryFilter) && (
              <button
                type="button"
                onClick={() => { setSearch(''); setCategoryFilter(''); setPage(1); }}
                className="text-xs text-gray-500 hover:text-red-600 underline px-1"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Expanded filter panel */}
        {showFilters && categories.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-3 items-center">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Category / Solution Area</label>
              <select
                value={categoryFilter}
                onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
                className="border border-gray-200 rounded-lg px-3 py-2 text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {loading ? (
          <InlineLoader />
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <ProductIcon className="w-10 h-10 mx-auto mb-3" color="text-gray-300" />
            <p className="text-gray-500 font-medium">No products found</p>
            {canManage && (
              <button onClick={openAdd} className="mt-3 text-sm text-blue-600 hover:underline">
                + Add your first product
              </button>
            )}
          </div>
        ) : (
          <div className={`transition-opacity duration-200 ${showRefreshing ? 'opacity-40' : 'opacity-100'}`}>
            {/* Mobile Card List (< 640px) */}
            <div className="block sm:hidden divide-y divide-gray-200">
              {products.map((p) => {
                const unitPrice = Number(p.basePrice);
                const taxAmt = unitPrice * (Number(p.tax) / 100);
                const withTax = unitPrice + taxAmt;
                const stock = p.inventory?.quantity ?? 0;
                const lowStock = !!(p.inventory?.reorderLevel && stock <= p.inventory.reorderLevel);

                return (
                  <div
                    key={p.id}
                    className="p-4 space-y-2.5 active:bg-blue-50/70 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-semibold">
                          {p.sku}
                        </span>
                        <h3 className="font-bold text-gray-900 text-sm mt-1">{p.name}</h3>
                      </div>
                      {p.inventory && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${stock === 0
                          ? 'bg-red-100 text-red-600 border-red-200'
                          : lowStock
                            ? 'bg-amber-100 text-amber-700 border-amber-200'
                            : 'bg-green-100 text-green-700 border-green-200'
                          }`}>
                          {stock === 0 ? 'Out of stock' : `${stock} in stock`}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs pt-0.5">
                      <div>
                        <span className="font-bold text-gray-900 text-sm">{fmt(withTax)}</span>
                        <span className="text-[10px] text-gray-400 block">incl. {p.tax}% GST</span>
                      </div>
                      {/* Same 16px-tall Edit/Delete pair as the follow-ups list —
                          see the note there. Edit was only 22px wide too, so the
                          two sat within a thumb's width of each other. */}
                      {canManage && (
                        <div className="flex items-center gap-1 sm:gap-3 -mr-2 sm:mr-0">
                          <button onClick={() => openEdit(p)} className="text-xs text-blue-600 font-semibold inline-flex items-center min-h-[40px] sm:min-h-0 px-2 sm:px-0 rounded-md active:bg-blue-50">
                            Edit
                          </button>
                          <button onClick={() => setDeleteId(p.id)} className="text-xs text-red-500 font-semibold inline-flex items-center min-h-[40px] sm:min-h-0 px-2 sm:px-0 rounded-md active:bg-red-50">
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop / Tablet Table View (>= 640px) */}
            <div className="hidden sm:block overflow-x-auto">
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
                      <tr
                        key={p.id}
                        onClick={() => router.push(`/products/${p.id}`)}
                        className="cursor-pointer table-row-interactive transition-all duration-150 ease-in-out hover:bg-blue-50/40"
                      >
                        <td className="px-4 py-3.5 text-center text-gray-400 text-xs font-medium">
                          {(page - 1) * 25 + idx + 1}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs text-gray-500">{p.sku}</td>
                        <td className="px-4 py-3.5 max-w-xs">
                          <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{p.name}</p>
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
                          <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => openEdit(p)}
                                className="text-xs text-blue-600 hover:text-blue-800 font-semibold px-2 py-0.5 rounded hover:bg-blue-50 transition-colors">Edit</button>
                              <button onClick={() => setDeleteId(p.id)}
                                className="text-xs text-red-600 hover:text-red-800 font-semibold px-2 py-0.5 rounded hover:bg-red-50 transition-colors">Delete</button>
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
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {addEditModalMounted && (
        <ProductModal
          initial={editProduct ? formFromProduct(editProduct) : emptyForm()}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
          saving={saving}
          error={modalError}
          leaving={addEditModalLeaving}
        />
      )}

      {/* Delete Confirm */}
      {deleteModalMounted && (
        <div className={`fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 ${deleteModalLeaving ? 'animate-fade-out' : 'animate-fade-in'}`}>
          <div className={`bg-white rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 w-full max-w-sm shadow-xl max-h-[92vh] overflow-y-auto ${deleteModalLeaving ? 'animate-slide-down sm:animate-scale-out' : 'animate-slide-up sm:animate-scale-in'}`}>
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
    </PageContainer>
  );
}
