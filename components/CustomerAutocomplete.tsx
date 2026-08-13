'use client';

import { useState, useEffect, useRef, useId } from 'react';
import { BuildingOfficeIcon } from '@heroicons/react/24/outline';

/**
 * Company-name field that also offers existing customers, and hands the whole
 * record back when one is picked so the caller can fill in the contact details
 * it already has on file.
 *
 * Deliberately *not* built on `LiveSearchDropdown`. That component is the
 * list-page search box: it owns a magnifier icon, a "View all results for …"
 * footer and a `router.push` on select. All three are wrong inside a create
 * form, where selecting a suggestion must fill fields rather than navigate.
 *
 * Free text is always allowed. These forms exist to capture *new* business, so
 * a company that isn't a customer yet has to remain typeable — the suggestions
 * are an offer, never a constraint. That's why there's no "no match" blocking
 * state and why `onChange` fires on every keystroke.
 */

export interface CustomerContact {
  name?: string;
  email?: string;
  phone?: string;
  designation?: string;
}

export interface CustomerSuggestion {
  id: string;
  companyName: string;
  gstNumber?: string;
  contacts?: CustomerContact[];
}

/** The primary contact, which is the only one `/api/customers` returns. */
export function primaryContact(c: CustomerSuggestion): CustomerContact {
  return (c.contacts || [])[0] || {};
}

export default function CustomerAutocomplete({
  value,
  onChange,
  onSelectCustomer,
  placeholder = 'Company / Organization',
  required,
  disabled,
  name,
  className = '',
  inputClassName = '',
  minChars = 2,
  debounceMs = 300,
}: {
  value: string;
  /** Fires on every keystroke — typing a brand-new company must keep working. */
  onChange: (value: string) => void;
  /** Fires only when an existing customer is chosen from the list. */
  onSelectCustomer: (customer: CustomerSuggestion) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  name?: string;
  className?: string;
  inputClassName?: string;
  minChars?: number;
  debounceMs?: number;
}) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CustomerSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against a slow early request landing after a fast later one and
  // repopulating the list with stale matches.
  const requestIdRef = useRef(0);
  // Set when a suggestion is chosen, so the resulting `value` change doesn't
  // immediately re-open the dropdown with the name we just filled in.
  const justPickedRef = useRef(false);

  useEffect(() => {
    if (justPickedRef.current) {
      justPickedRef.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < minChars) {
      setResults([]);
      setOpen(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const id = ++requestIdRef.current;
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const params = new URLSearchParams({ search: q, page: '1', limit: '8' });
        const res = await fetch(`/api/customers?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('lookup failed');
        const data = await res.json();
        if (id !== requestIdRef.current) return;
        const list: CustomerSuggestion[] = data.customers || data.data || [];
        setResults(list);
        setOpen(list.length > 0);
        setActiveIndex(-1);
      } catch {
        // A failed lookup must never block typing — drop the suggestions and
        // let the field behave as a plain text input.
        if (id === requestIdRef.current) {
          setResults([]);
          setOpen(false);
        }
      } finally {
        if (id === requestIdRef.current) setLoading(false);
      }
    }, debounceMs);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, minChars, debounceMs]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const pick = (c: CustomerSuggestion) => {
    justPickedRef.current = true;
    onSelectCustomer(c);
    setOpen(false);
    setActiveIndex(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      // Only intercept Enter while a suggestion is highlighted, so Enter
      // otherwise still submits the form as usual.
      e.preventDefault();
      pick(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        type="text"
        name={name}
        value={value}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        onChange={e => onChange(e.target.value)}
        onFocus={() => { if (results.length > 0) setOpen(true); }}
        onKeyDown={onKeyDown}
        className={`w-full ${inputClassName}`}
      />

      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      )}

      {open && results.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-y-auto search-dropdown-enter"
        >
          <li className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
            Existing customers
          </li>
          {results.map((c, idx) => {
            const p = primaryContact(c);
            return (
              <li
                key={c.id}
                role="option"
                aria-selected={activeIndex === idx}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseDown={e => { e.preventDefault(); pick(c); }}
                className={`px-3 py-2.5 cursor-pointer border-b border-gray-50 last:border-b-0 transition-colors ${
                  activeIndex === idx ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <BuildingOfficeIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm font-semibold text-gray-900 truncate">{c.companyName}</span>
                </div>
                {/* Showing the contact details on the row is the point: it tells
                    you what picking this row is about to fill in. */}
                <p className="text-xs text-gray-500 mt-0.5 truncate pl-6">
                  {[p.name, p.email, p.phone].filter(Boolean).join(' · ') || 'No primary contact on file'}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
