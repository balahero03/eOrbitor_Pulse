'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const CSV_COLUMNS = [
  'companyName',
  'gstNumber',
  'customerCategory',
  'industry',
  'website',
  'annualRevenue',
  'yearEstablished',
  'billingAddress',
  'shippingAddress',
  'contactName',
  'contactDesignation',
  'contactEmail',
  'contactPhone',
];

interface ImportResult {
  row: number;
  companyName?: string;
  status: 'created' | 'skipped' | 'error';
  message?: string;
}

// Minimal RFC-4180-ish CSV parser: handles quoted fields, embedded commas,
// escaped double-quotes ("") and \r\n / \n line endings.
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\r') {
      // ignore; handled by following \n (or EOF below)
    } else {
      field += ch;
    }
  }
  // flush last field/row if file doesn't end with newline
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export default function NewCustomerPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'single' | 'csv'>('single');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // CSV import state
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [importSummary, setImportSummary] = useState<{
    total: number;
    created: number;
    skipped: number;
    errors: number;
  } | null>(null);

  const [formData, setFormData] = useState({
    // Company
    companyName: '',
    gstNumber: '',
    industry: '',
    website: '',
    annualRevenue: '',
    yearEstablished: '',
    customerCategory: 'ACTIVE',
    billingAddress: '',
    shippingAddress: '',
    // Primary contact
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    contactDesignation: '',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to create customer');
      }

      const created = await res.json();
      router.push(`/customers/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const sample = [
      'Acme Industries Pvt Ltd',
      '22AAAAA0000A1Z5',
      'ACTIVE',
      'Manufacturing',
      'https://acme.example.com',
      '5000000',
      '2010',
      '12 MG Road, Bengaluru',
      '',
      'Ravi Kumar',
      'Procurement Head',
      'ravi@acme.example.com',
      '+91 98765 43210',
    ];
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const csv = [CSV_COLUMNS.join(','), sample.map(esc).join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customer-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    setImportResults([]);
    setImportSummary(null);
    setCsvRows([]);
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '').replace(/^﻿/, ''); // strip BOM
        const grid = parseCSV(text).filter((r) => r.some((c) => c.trim() !== ''));
        if (grid.length < 2) {
          throw new Error('CSV must have a header row and at least one data row');
        }
        const header = grid[0].map((h) => h.trim());
        const rows = grid.slice(1).map((cells) => {
          const obj: Record<string, string> = {};
          header.forEach((h, idx) => {
            obj[h] = (cells[idx] ?? '').trim();
          });
          return obj;
        });
        setCsvRows(rows);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to read CSV');
        setCsvFileName('');
      }
    };
    reader.onerror = () => setError('Failed to read file');
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (csvRows.length === 0) {
      setError('Choose a CSV file with at least one data row first');
      return;
    }
    setError('');
    setImportResults([]);
    setImportSummary(null);
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/customers/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rows: csvRows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Import failed');
      setImportSummary(data.summary);
      setImportResults(data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Add Existing Customer</h1>
        <Link
          href="/customers"
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
        >
          Back to Customers
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 max-w-2xl">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
          <p className="text-sm text-indigo-800">
            <strong>Existing Customer:</strong> Add a company you already do business
            with. This creates a customer record directly, without going through the lead
            pipeline.
          </p>
        </div>

        {/* Mode toggle */}
        <div className="mb-6 inline-flex rounded-lg border border-gray-300 overflow-hidden">
          <button
            type="button"
            onClick={() => { setMode('single'); setError(''); }}
            className={`px-4 py-2 text-sm font-medium ${mode === 'single' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
          >
            Single Customer
          </button>
          <button
            type="button"
            onClick={() => { setMode('csv'); setError(''); }}
            className={`px-4 py-2 text-sm font-medium border-l border-gray-300 ${mode === 'csv' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
          >
            Import from CSV
          </button>
        </div>

        {mode === 'csv' ? (
          <div className="space-y-6">
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 space-y-2">
              <p>
                Upload a CSV with these columns (header row required). Required:{' '}
                <code className="bg-gray-200 px-1 rounded">companyName</code>,{' '}
                <code className="bg-gray-200 px-1 rounded">gstNumber</code>,{' '}
                <code className="bg-gray-200 px-1 rounded">contactName</code>,{' '}
                <code className="bg-gray-200 px-1 rounded">contactEmail</code>.
              </p>
              <p className="text-xs text-gray-500 break-all">{CSV_COLUMNS.join(', ')}</p>
              <button
                type="button"
                onClick={downloadTemplate}
                className="text-blue-600 hover:underline text-sm font-medium"
              >
                ↓ Download CSV template
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">CSV File</label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFile}
                className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {csvFileName && csvRows.length > 0 && (
                <p className="mt-2 text-sm text-gray-600">
                  <strong>{csvFileName}</strong> — {csvRows.length} row{csvRows.length === 1 ? '' : 's'} ready to import.
                </p>
              )}
            </div>

            {importSummary && (
              <div className="p-4 bg-white border border-gray-200 rounded-lg">
                <div className="flex flex-wrap gap-4 text-sm font-medium mb-3">
                  <span className="text-gray-700">Total: {importSummary.total}</span>
                  <span className="text-green-700">Created: {importSummary.created}</span>
                  <span className="text-amber-700">Skipped: {importSummary.skipped}</span>
                  <span className="text-red-700">Errors: {importSummary.errors}</span>
                </div>
                <div className="max-h-64 overflow-y-auto border border-gray-100 rounded">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Row</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Company</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Status</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Detail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {importResults.map((r) => (
                        <tr key={r.row}>
                          <td className="px-3 py-2 text-gray-600">{r.row}</td>
                          <td className="px-3 py-2 text-gray-800">{r.companyName || '—'}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              r.status === 'created' ? 'bg-green-100 text-green-800'
                              : r.status === 'skipped' ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                            }`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-500">{r.message || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importSummary.created > 0 && (
                  <div className="mt-4">
                    <Link href="/customers" className="text-blue-600 hover:underline text-sm font-medium">
                      → View customers
                    </Link>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-4 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleImport}
                disabled={loading || csvRows.length === 0}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Importing...' : `Import ${csvRows.length || ''} Customer${csvRows.length === 1 ? '' : 's'}`}
              </button>
              <Link
                href="/customers"
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 text-center"
              >
                Cancel
              </Link>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Information */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">
              Company Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Company Name *</label>
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  placeholder="e.g. ABC Industries Pvt Ltd"
                  required
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">GST Number *</label>
                <input
                  type="text"
                  name="gstNumber"
                  value={formData.gstNumber}
                  onChange={handleChange}
                  placeholder="e.g. 22AAAAA0000A1Z5"
                  required
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  name="customerCategory"
                  value={formData.customerCategory}
                  onChange={handleChange}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="PROSPECT">Prospect</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="LOST">Lost</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Industry</label>
                <input
                  type="text"
                  name="industry"
                  value={formData.industry}
                  onChange={handleChange}
                  placeholder="e.g. Manufacturing"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Website</label>
                <input
                  type="text"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  placeholder="https://example.com"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Annual Revenue (₹)
                </label>
                <input
                  type="number"
                  name="annualRevenue"
                  value={formData.annualRevenue}
                  onChange={handleChange}
                  placeholder="e.g. 5000000"
                  min="0"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Year Established</label>
                <input
                  type="number"
                  name="yearEstablished"
                  value={formData.yearEstablished}
                  onChange={handleChange}
                  placeholder="e.g. 2010"
                  min="1800"
                  max={new Date().getFullYear()}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
          </div>

          {/* Addresses */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">
              Addresses
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Billing Address</label>
                <textarea
                  name="billingAddress"
                  value={formData.billingAddress}
                  onChange={handleChange}
                  placeholder="Complete billing address"
                  rows={2}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Shipping Address
                </label>
                <textarea
                  name="shippingAddress"
                  value={formData.shippingAddress}
                  onChange={handleChange}
                  placeholder="Leave blank if same as billing"
                  rows={2}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
          </div>

          {/* Primary Contact */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-800 border-b pb-2">
              Primary Contact
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Contact Name *</label>
                <input
                  type="text"
                  name="contactName"
                  value={formData.contactName}
                  onChange={handleChange}
                  placeholder="Full name"
                  required
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Designation</label>
                <input
                  type="text"
                  name="contactDesignation"
                  value={formData.contactDesignation}
                  onChange={handleChange}
                  placeholder="e.g. Procurement Head"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input
                  type="email"
                  name="contactEmail"
                  value={formData.contactEmail}
                  onChange={handleChange}
                  placeholder="contact@company.com"
                  required
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input
                  type="tel"
                  name="contactPhone"
                  value={formData.contactPhone}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Customer'}
            </button>
            <Link
              href="/customers"
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 text-center"
            >
              Cancel
            </Link>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
