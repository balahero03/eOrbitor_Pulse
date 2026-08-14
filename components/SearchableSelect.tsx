'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useMountTransition } from '@/lib/hooks/useMountTransition';

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** Shown as a smaller second line under the label — e.g. a role or email. */
  sublabel?: string;
}

/**
 * A single-select dropdown that filters as you type.
 *
 * Every "choose one employee" control in the app was a native `<select>`
 * listing every user with no way to search — fine at five people, unusable
 * once a team grows past a page's worth. Native selects also can't show a
 * sublabel (role, email) or take a custom option layout.
 *
 * Not built on LiveSearchDropdown: that component debounces and calls a
 * remote search function, which is the wrong shape for a list that's already
 * fully loaded in memory (the whole point here is filtering it instantly,
 * with no round trip). Filtering is plain client-side substring matching.
 *
 * Uses the same enter/exit animation and focus/keyboard handling established
 * by LiveSearchDropdown and MultiSelectSearch, so every dropdown in the app —
 * remote-search, multi-select, or this — opens and closes the same way.
 */
export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  emptyOptionLabel,
  className = '',
  disabled = false,
}: {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** If set, an extra option at the top (value `''`) — e.g. "All Employees". */
  emptyOptionLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const { mounted, leaving } = useMountTransition(isOpen, 120);

  const allOptions = useMemo<SearchableSelectOption[]>(
    () => (emptyOptionLabel ? [{ value: '', label: emptyOptionLabel }, ...options] : options),
    [options, emptyOptionLabel]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allOptions;
    return allOptions.filter(
      (o) => o.label.toLowerCase().includes(q) || o.sublabel?.toLowerCase().includes(q)
    );
  }, [allOptions, query]);

  const selected = allOptions.find((o) => o.value === value);

  // Outside click closes, matching every other dropdown in the app.
  useEffect(() => {
    if (!isOpen) return;
    const onDocDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      // rAF so the search input exists and is painted before it's focused.
      const raf = requestAnimationFrame(() => searchRef.current?.focus());
      return () => cancelAnimationFrame(raf);
    }
  }, [isOpen]);

  useEffect(() => setActiveIndex(0), [query]);

  const commit = (opt: SearchableSelectOption) => {
    onChange(opt.value);
    setIsOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setIsOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, filtered.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); return; }
    if (e.key === 'Enter') { e.preventDefault(); if (filtered[activeIndex]) commit(filtered[activeIndex]); return; }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 border border-gray-300 rounded-lg px-3 py-2 text-sm text-left bg-white transition-shadow focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
      >
        <span className={`truncate ${selected ? 'text-gray-900' : 'text-gray-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronUpDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </button>

      {mounted && (
        <div
          role="listbox"
          className={`${leaving ? 'search-dropdown-exit' : 'search-dropdown-enter'} absolute z-40 left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl ring-1 ring-black/5 overflow-hidden`}
        >
          <div className="p-2 border-b border-gray-100">
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search…"
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-sm text-gray-400 text-center">No matches</p>
            ) : (
              filtered.map((opt, idx) => (
                <div
                  key={opt.value || '__empty'}
                  role="option"
                  aria-selected={opt.value === value}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseDown={(e) => { e.preventDefault(); commit(opt); }}
                  className={`flex items-center justify-between gap-2 px-3 py-2 text-sm cursor-pointer ${
                    idx === activeIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-gray-900">{opt.label}</span>
                    {opt.sublabel && <span className="block truncate text-xs text-gray-400">{opt.sublabel}</span>}
                  </span>
                  {opt.value === value && <CheckIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
