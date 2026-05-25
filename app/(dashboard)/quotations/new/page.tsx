'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Deal {
  id: string;
  dealName: string;
  customerId: string;
  customer: { companyName: string };
}

interface Product {
  id: string;
  sku: string;
  name: string;
  basePrice: string;
  tax: string;
  inventory?: { quantity: number };
}

interface QuotationItem {
  productId: string;
  product?: Product;
  quantity: number;
  unitPrice: number;
}

export default function NewQuotationPage() {
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchProduct, setSearchProduct] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);

  const [formData, setFormData] = useState({
    dealId: '',
    customerId: '',
    notes: '',
  });

  const [items, setItems] = useState<QuotationItem[]>([]);

  useEffect(() => {
    fetchDeals();
    fetchProducts();
  }, []);

  const fetchDeals = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/deals?limit=1000', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch deals');

      const data = await res.json();
      setDeals(data.deals);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        ...(searchProduct && { search: searchProduct }),
      });

      const res = await fetch(`/api/products?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch products');

      const data = await res.json();
      setProducts(data.products);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDealChange = (dealId: string) => {
    const deal = deals.find(d => d.id === dealId);
    setFormData({
      ...formData,
      dealId,
      customerId: deal?.customerId || '',
    });
  };

  const handleAddProduct = (product: Product) => {
    const newItem: QuotationItem = {
      productId: product.id,
      product,
      quantity: 1,
      unitPrice: parseFloat(product.basePrice),
    };
    setItems([...items, newItem]);
    setShowProductSearch(false);
    setSearchProduct('');
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let taxAmount = 0;

    items.forEach(item => {
      const lineSubtotal = item.quantity * item.unitPrice;
      subtotal += lineSubtotal;

      if (item.product) {
        const lineTax = lineSubtotal * (parseFloat(item.product.tax) / 100);
        taxAmount += lineTax;
      }
    });

    return { subtotal, taxAmount, total: subtotal + taxAmount };
  };

  const totals = calculateTotals();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!formData.dealId || !formData.customerId || items.length === 0) {
        throw new Error('Deal, customer, and at least one product item are required');
      }

      const token = localStorage.getItem('token');
      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dealId: formData.dealId,
          customerId: formData.customerId,
          items: items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
          notes: formData.notes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to create quotation');
      }

      const newQuotation = await res.json();
      router.push(`/quotations/${newQuotation.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Create New Quotation</h1>
        <Link href="/quotations" className="btn btn-secondary">Back to Quotations</Link>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Form Section */}
        <div className="col-span-2">
          <div className="card p-8">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Deal & Customer */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Deal Information</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Deal *</label>
                    <select
                      value={formData.dealId}
                      onChange={(e) => handleDealChange(e.target.value)}
                      required
                      className="w-full"
                    >
                      <option value="">Select a deal</option>
                      {deals.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.dealName} - {d.customer.companyName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Customer</label>
                    <input
                      type="text"
                      value={formData.customerId ? 'Selected' : ''}
                      disabled
                      className="w-full bg-gray-100"
                    />
                  </div>
                </div>
              </div>

              {/* Products */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Products & Items</h3>

                {/* Add Product */}
                <div className="mb-4 relative">
                  <button
                    type="button"
                    onClick={() => setShowProductSearch(!showProductSearch)}
                    className="btn btn-secondary w-full"
                  >
                    + Add Product
                  </button>

                  {showProductSearch && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded shadow-lg z-10">
                      <input
                        type="text"
                        placeholder="Search products..."
                        value={searchProduct}
                        onChange={(e) => {
                          setSearchProduct(e.target.value);
                        }}
                        onBlur={() => setTimeout(() => fetchProducts(), 100)}
                        className="w-full p-2 border-b"
                        autoFocus
                      />
                      <div className="max-h-48 overflow-y-auto">
                        {products.length === 0 ? (
                          <p className="p-3 text-gray-500 text-sm">No products found</p>
                        ) : (
                          products.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => handleAddProduct(p)}
                              className="w-full text-left p-3 hover:bg-gray-100 border-b text-sm"
                            >
                              <p className="font-medium">{p.name}</p>
                              <p className="text-xs text-gray-600">{p.sku} - {formatCurrency(parseFloat(p.basePrice))}</p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Items Table */}
                {items.length > 0 && (
                  <div className="overflow-x-auto border border-gray-200 rounded mb-4">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-2 text-left">Product</th>
                          <th className="px-4 py-2 text-right w-20">Qty</th>
                          <th className="px-4 py-2 text-right w-32">Unit Price</th>
                          <th className="px-4 py-2 text-right w-32">Tax %</th>
                          <th className="px-4 py-2 text-right w-32">Total</th>
                          <th className="px-4 py-2 w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => {
                          const lineTotal = item.quantity * item.unitPrice;
                          const taxPercent = item.product?.tax || '0';
                          const lineTax = lineTotal * (parseFloat(taxPercent) / 100);
                          const lineGrandTotal = lineTotal + lineTax;

                          return (
                            <tr key={idx} className="border-b">
                              <td className="px-4 py-2">{item.product?.name}</td>
                              <td className="px-4 py-2">
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value))}
                                  min="1"
                                  className="w-full text-right"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <input
                                  type="number"
                                  value={item.unitPrice}
                                  onChange={(e) => handleItemChange(idx, 'unitPrice', parseFloat(e.target.value))}
                                  step="0.01"
                                  className="w-full text-right"
                                />
                              </td>
                              <td className="px-4 py-2 text-right">{taxPercent}%</td>
                              <td className="px-4 py-2 text-right font-medium">{formatCurrency(lineGrandTotal)}</td>
                              <td className="px-4 py-2">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="text-red-600 hover:text-red-800 text-sm"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Terms, conditions, special notes..."
                  className="w-full h-20"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-4 pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={loading || items.length === 0}
                  className="btn btn-primary flex-1"
                >
                  {loading ? 'Creating...' : 'Create Quotation'}
                </button>
                <Link href="/quotations" className="btn btn-secondary flex-1 text-center">
                  Cancel
                </Link>
              </div>
            </form>
          </div>
        </div>

        {/* Summary Sidebar */}
        <div className="card p-6 h-fit">
          <h3 className="text-lg font-semibold mb-4">Summary</h3>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax:</span>
              <span className="font-medium">{formatCurrency(totals.taxAmount)}</span>
            </div>
            <div className="border-t pt-3 flex justify-between">
              <span className="font-semibold">Total:</span>
              <span className="text-lg font-bold">{formatCurrency(totals.total)}</span>
            </div>
          </div>

          <div className="mt-6 p-3 bg-blue-50 rounded border border-blue-200 text-xs text-blue-800">
            <p className="font-semibold mb-1">Items: {items.length}</p>
            <p>Add products from the list and adjust quantities and prices as needed.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
