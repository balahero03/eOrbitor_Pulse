'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface WonLead {
  id: string;
  name: string;
  company: string;
  quoteValue: string | null;
  linkedCustomerId: string | null;
  linkedCustomer: { id: string; companyName: string } | null;
  assignedTo: { firstName: string; lastName: string };
}

interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  basePrice: string;
  tax: string;
  attributes?: Record<string, string>;
}

interface LineItem {
  productId?: string;
  productName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(v);

export default function NewQuotationPage() {
  const router = useRouter();

  // Lead / customer selection
  const [leadSearch, setLeadSearch] = useState('');
  const [leadResults, setLeadResults] = useState<WonLead[]>([]);
  const [selectedLead, setSelectedLead] = useState<WonLead | null>(null);
  const [showLeadDropdown, setShowLeadDropdown] = useState(false);
  const leadSearchRef = useRef<HTMLDivElement>(null);

  // Product search
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const productSearchRef = useRef<HTMLDivElement>(null);

  // Line items
  const [items, setItems] = useState<LineItem[]>([]);

  // Terms fields
  const [terms, setTerms] = useState({
    priceValidity: '',
    taxDetails: '',
    warranty: '',
    amcPeriod: '',
    deliveryEstimate: '',
    paymentTerms: '',
    notes: '',
    discountAmount: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Search won leads
  useEffect(() => {
    if (!leadSearch.trim()) { setLeadResults([]); return; }
    const t = setTimeout(async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/leads/won?search=${encodeURIComponent(leadSearch)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { const d = await res.json(); setLeadResults(d.leads); }
    }, 250);
    return () => clearTimeout(t);
  }, [leadSearch]);

  // Search products
  useEffect(() => {
    if (!productSearch.trim()) { setProductResults([]); return; }
    const t = setTimeout(async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/products?search=${encodeURIComponent(productSearch)}&limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { const d = await res.json(); setProductResults(d.products); }
    }, 250);
    return () => clearTimeout(t);
  }, [productSearch]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (leadSearchRef.current && !leadSearchRef.current.contains(e.target as Node))
        setShowLeadDropdown(false);
      if (productSearchRef.current && !productSearchRef.current.contains(e.target as Node))
        setShowProductDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectLead = (lead: WonLead) => {
    setSelectedLead(lead);
    setLeadSearch(`${lead.name} — ${lead.company}`);
    setShowLeadDropdown(false);
    setLeadResults([]);
  };

  const addProduct = (p: Product) => {
    setItems(prev => [...prev, {
      productId: p.id,
      productName: p.name,
      description: '',
      quantity: 1,
      unitPrice: parseFloat(p.basePrice),
      taxRate: parseFloat(p.tax),
    }]);
    setProductSearch('');
    setProductResults([]);
    setShowProductDropdown(false);
  };

  const addBlankItem = () => {
    setItems(prev => [...prev, {
      productName: '',
      description: '',
      quantity: 1,
      unitPrice: 0,
      taxRate: 18,
    }]);
  };

  const updateItem = (idx: number, field: keyof LineItem, value: any) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxTotal = items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.taxRate / 100), 0);
  const discount = parseFloat(terms.discountAmount || '0') || 0;
  const grandTotal = subtotal + taxTotal - discount;

  const handleSubmit = async () => {
    setError('');
    if (!selectedLead) { setError('Please select a won lead / customer.'); return; }
    if (items.length === 0) { setError('Add at least one line item.'); return; }
    if (items.some(i => !i.productName.trim())) { setError('All items must have a name.'); return; }

    const customerId = selectedLead.linkedCustomerId;
    if (!customerId) {
      setError('This lead has no linked customer. Please link a customer to the lead first.');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          leadId: selectedLead.id,
          customerId,
          items: items.map(i => ({
            productId: i.productId,
            productName: i.productName,
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            taxRate: i.taxRate,
          })),
          ...terms,
          discountAmount: discount,
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.message || 'Failed to create quotation');
      }
      const q = await res.json();
      router.push(`/quotations/${q.id}`);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Quotation</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create a quotation from a won lead</p>
        </div>
        <Link href="/quotations" className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
          ← Back
        </Link>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {/* Lead / Customer selection */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Customer (from Won Lead)</h2>
        <div ref={leadSearchRef} className="relative">
          <input
            type="text"
            value={leadSearch}
            onChange={e => { setLeadSearch(e.target.value); setShowLeadDropdown(true); setSelectedLead(null); }}
            onFocus={() => setShowLeadDropdown(true)}
            placeholder="Search by lead name or company…"
            className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          {showLeadDropdown && leadResults.length > 0 && (
            <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border rounded-xl shadow-lg max-h-60 overflow-y-auto">
              {leadResults.map(lead => (
                <button
                  key={lead.id}
                  type="button"
                  onMouseDown={() => selectLead(lead)}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-50 last:border-0"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{lead.name}</p>
                      <p className="text-xs text-gray-500">{lead.company}</p>
                    </div>
                    <div className="text-right">
                      {lead.quoteValue && (
                        <p className="text-xs font-semibold text-green-700">{fmt(Number(lead.quoteValue))}</p>
                      )}
                      {lead.linkedCustomer ? (
                        <p className="text-xs text-blue-600">✓ {lead.linkedCustomer.companyName}</p>
                      ) : (
                        <p className="text-xs text-amber-500">⚠ No customer linked</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {showLeadDropdown && leadSearch.trim() && leadResults.length === 0 && (
            <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border rounded-xl shadow-lg p-4 text-sm text-gray-400 text-center">
              No won leads found for "{leadSearch}"
            </div>
          )}
        </div>

        {selectedLead && (
          <div className="mt-3 flex items-center gap-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">{selectedLead.name}</p>
              <p className="text-xs text-gray-500">{selectedLead.company}</p>
            </div>
            {selectedLead.linkedCustomer ? (
              <div className="text-right">
                <p className="text-xs text-gray-400 uppercase font-medium">Customer</p>
                <p className="text-sm font-medium text-blue-700">{selectedLead.linkedCustomer.companyName}</p>
              </div>
            ) : (
              <p className="text-xs text-amber-600 font-medium">⚠ Link a customer to this lead before creating a quotation</p>
            )}
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800">Line Items</h2>
          <div className="flex gap-2">
            {/* Product search */}
            <div ref={productSearchRef} className="relative">
              <input
                type="text"
                value={productSearch}
                onChange={e => { setProductSearch(e.target.value); setShowProductDropdown(true); }}
                onFocus={() => setShowProductDropdown(true)}
                placeholder="Search product…"
                className="border rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              {showProductDropdown && productResults.length > 0 && (
                <div className="absolute z-20 top-full mt-1 right-0 w-72 bg-white border rounded-xl shadow-lg max-h-52 overflow-y-auto">
                  {productResults.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={() => addProduct(p)}
                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-gray-50 last:border-0"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.sku} · {fmt(parseFloat(p.basePrice))} · {p.tax}% GST</p>
                          {p.description && <p className="text-xs text-gray-400 truncate">{p.description}</p>}
                          {p.attributes && Object.keys(p.attributes).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {Object.entries(p.attributes).slice(0, 3).map(([k, v]) => (
                                <span key={k} className="text-[10px] px-1 py-0.5 bg-gray-100 text-gray-500 rounded">
                                  {k}: {String(v)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {p.category && (
                          <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded flex-shrink-0">{p.category}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={addBlankItem}
              className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
            >
              + Blank Row
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm border border-dashed rounded-lg">
            Search for a product above or add a blank row
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Item / Product</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Description</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-20">Qty</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-32">Unit Price ₹</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-24">GST %</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase w-32">Amount</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((item, idx) => {
                  const lineAmt = item.quantity * item.unitPrice;
                  const lineTax = lineAmt * (item.taxRate / 100);
                  return (
                    <tr key={idx}>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={item.productName}
                          onChange={e => updateItem(idx, 'productName', e.target.value)}
                          placeholder="Item name"
                          className="w-full border-0 border-b border-gray-200 px-0 py-1 text-sm focus:outline-none focus:border-blue-400 bg-transparent"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={e => updateItem(idx, 'description', e.target.value)}
                          placeholder="Optional"
                          className="w-full border-0 border-b border-gray-200 px-0 py-1 text-sm focus:outline-none focus:border-blue-400 bg-transparent"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={e => updateItem(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                          min="1"
                          className="w-full text-right border-0 border-b border-gray-200 px-0 py-1 text-sm focus:outline-none focus:border-blue-400 bg-transparent"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={e => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                          step="0.01"
                          min="0"
                          className="w-full text-right border-0 border-b border-gray-200 px-0 py-1 text-sm focus:outline-none focus:border-blue-400 bg-transparent"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={item.taxRate}
                          onChange={e => updateItem(idx, 'taxRate', parseFloat(e.target.value) || 0)}
                          step="0.5"
                          min="0"
                          className="w-full text-right border-0 border-b border-gray-200 px-0 py-1 text-sm focus:outline-none focus:border-blue-400 bg-transparent"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-gray-800">
                        {fmt(lineAmt + lineTax)}
                      </td>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => removeItem(idx)}
                          className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none">
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals */}
        {items.length > 0 && (
          <div className="mt-4 flex justify-end">
            <div className="w-72 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span className="font-medium">{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>GST / Tax</span>
                <span className="font-medium">{fmt(taxTotal)}</span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span>Discount</span>
                <input
                  type="number"
                  value={terms.discountAmount}
                  onChange={e => setTerms(t => ({ ...t, discountAmount: e.target.value }))}
                  placeholder="0"
                  min="0"
                  className="w-28 text-right border rounded px-2 py-1 text-sm"
                />
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-bold text-gray-900">
                <span>Grand Total</span>
                <span className="text-green-700">{fmt(grandTotal)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Terms & Conditions */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Terms &amp; Conditions</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Price Validity</label>
            <input
              type="text"
              value={terms.priceValidity}
              onChange={e => setTerms(t => ({ ...t, priceValidity: e.target.value }))}
              placeholder="e.g. 30 days from date of quotation"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Taxes</label>
            <input
              type="text"
              value={terms.taxDetails}
              onChange={e => setTerms(t => ({ ...t, taxDetails: e.target.value }))}
              placeholder="e.g. GST 18% extra as applicable"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Warranty</label>
            <input
              type="text"
              value={terms.warranty}
              onChange={e => setTerms(t => ({ ...t, warranty: e.target.value }))}
              placeholder="e.g. 1 year onsite warranty"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">AMC Period</label>
            <input
              type="text"
              value={terms.amcPeriod}
              onChange={e => setTerms(t => ({ ...t, amcPeriod: e.target.value }))}
              placeholder="e.g. 1 year post-warranty AMC"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Delivery Estimate</label>
            <input
              type="text"
              value={terms.deliveryEstimate}
              onChange={e => setTerms(t => ({ ...t, deliveryEstimate: e.target.value }))}
              placeholder="e.g. 7–10 working days after PO"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Payment Terms</label>
            <input
              type="text"
              value={terms.paymentTerms}
              onChange={e => setTerms(t => ({ ...t, paymentTerms: e.target.value }))}
              placeholder="e.g. 50% advance, 50% on delivery"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Additional Notes</label>
            <textarea
              value={terms.notes}
              onChange={e => setTerms(t => ({ ...t, notes: e.target.value }))}
              placeholder="Any other terms, conditions, or notes…"
              className="w-full border rounded-lg px-3 py-2 text-sm h-20 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex gap-3 pb-6">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Creating Quotation…' : 'Create Quotation'}
        </button>
        <Link href="/quotations"
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 text-center">
          Cancel
        </Link>
      </div>
    </div>
  );
}
