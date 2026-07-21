'use client';

import { useState, useEffect, useRef, useId, KeyboardEvent, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { SearchIcon } from '@/components/icons';

// Wraps case-insensitive matches of `query` inside `text` in a <mark>, so the
// part of a suggestion that actually matched what you typed stands out.
export function highlightMatch(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q || !text) return text;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    part.toLowerCase() === q.toLowerCase()
      ? <mark key={i} className="bg-yellow-200 text-inherit rounded-sm px-0.5">{part}</mark>
      : <span key={i}>{part}</span>
  );
}

// Per-module, per-session cache of recent queries — avoids re-fetching a
// query the user already typed this page load (e.g. backspacing then
// retyping the same thing), on top of the debounce below.
const suggestionCache = new Map<string, unknown[]>();

interface LiveSearchDropdownProps<T> {
  value: string;
  onChange: (value: string) => void;
  /** Full search — Enter with nothing highlighted, or "View all results". */
  onSearch: (query: string) => void;
  fetchSuggestions: (query: string) => Promise<T[]>;
  getKey: (item: T) => string;
  /** Default select behaviour: router.push(getHref(item)). */
  getHref: (item: T) => string;
  /**
   * Overrides the default push-to-href select behaviour — for modules with
   * no detail route (Users, Announcements), where "opening" a result means
   * staying on the list and ringing the matching row instead.
   */
  onSelect?: (item: T) => void;
  renderItem: (item: T, query: string) => ReactNode;
  placeholder: string;
  ariaLabel: string;
  /** Namespaces the in-memory cache per module (e.g. "leads", "customers"). */
  cacheKeyPrefix: string;
  minChars?: number;
  debounceMs?: number;
  className?: string;
}

export default function LiveSearchDropdown<T>({
  value,
  onChange,
  onSearch,
  fetchSuggestions,
  getKey,
  getHref,
  onSelect,
  renderItem,
  placeholder,
  ariaLabel,
  cacheKeyPrefix,
  minChars = 2,
  debounceMs = 350,
  className = '',
}: LiveSearchDropdownProps<T>) {
  const router = useRouter();
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<T[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const trimmed = value.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (trimmed.length < minChars) {
      requestIdRef.current++; // invalidate any in-flight request
      setOpen(false);
      setSuggestions([]);
      setLoading(false);
      setHasSearched(false);
      setActiveIndex(-1);
      return;
    }

    const cacheKey = `${cacheKeyPrefix}:${trimmed.toLowerCase()}`;
    const cached = suggestionCache.get(cacheKey);
    if (cached) {
      setSuggestions(cached as T[]);
      setOpen(true);
      setHasSearched(true);
      setActiveIndex(-1);
      setLoading(false);
      return;
    }

    setLoading(true);
    setOpen(true);
    debounceRef.current = setTimeout(() => {
      const myRequestId = ++requestIdRef.current;
      fetchSuggestions(trimmed)
        .then((results) => {
          if (myRequestId !== requestIdRef.current) return; // superseded by a later keystroke
          suggestionCache.set(cacheKey, results as unknown[]);
          setSuggestions(results);
          setHasSearched(true);
          setActiveIndex(-1);
        })
        .catch(() => {
          if (myRequestId !== requestIdRef.current) return;
          setSuggestions([]);
          setHasSearched(true);
        })
        .finally(() => {
          if (myRequestId === requestIdRef.current) setLoading(false);
        });
    }, debounceMs);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, cacheKeyPrefix, minChars, debounceMs]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectItem = (item: T) => {
    setOpen(false);
    if (onSelect) onSelect(item);
    else router.push(getHref(item));
  };

  const runFullSearch = () => {
    setOpen(false);
    onSearch(value);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (open && activeIndex >= 0 && activeIndex < suggestions.length) {
        selectItem(suggestions[activeIndex]);
      } else {
        runFullSearch();
      }
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length)); // last index = "View all" row
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    }
  };

  const showEmptyState = !loading && hasSearched && suggestions.length === 0;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined}
          aria-label={ariaLabel}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (value.trim().length >= minChars) setOpen(true); }}
          autoComplete="off"
          className="w-full border border-gray-300 rounded-lg !pl-9 !pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
        />
        {loading && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2" aria-hidden="true">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={`${ariaLabel} suggestions`}
          className="search-dropdown-enter absolute z-40 left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl ring-1 ring-black/5 overflow-hidden max-h-96 overflow-y-auto"
        >
          {loading && suggestions.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-400 text-center flex items-center justify-center gap-2" aria-live="polite">
              <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              Searching…
            </div>
          ) : showEmptyState ? (
            <div className="px-4 py-6 text-center" aria-live="polite">
              <SearchIcon className="w-5 h-5 mx-auto mb-1.5 opacity-60" />
              <p className="text-sm text-gray-500">No results found for &ldquo;{value.trim()}&rdquo;</p>
            </div>
          ) : (
            <>
              {suggestions.map((item, idx) => (
                <div
                  key={getKey(item)}
                  id={`${listboxId}-opt-${idx}`}
                  role="option"
                  aria-selected={activeIndex === idx}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseDown={(e) => { e.preventDefault(); selectItem(item); }}
                  className={`px-4 py-2.5 cursor-pointer border-b border-gray-50 last:border-b-0 transition-colors ${
                    activeIndex === idx ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  {renderItem(item, value)}
                </div>
              ))}
              {suggestions.length > 0 && (
                <div
                  id={`${listboxId}-opt-${suggestions.length}`}
                  role="option"
                  aria-selected={activeIndex === suggestions.length}
                  onMouseEnter={() => setActiveIndex(suggestions.length)}
                  onMouseDown={(e) => { e.preventDefault(); runFullSearch(); }}
                  className={`px-4 py-2.5 text-sm font-medium text-blue-600 text-center cursor-pointer transition-colors border-t border-gray-100 ${
                    activeIndex === suggestions.length ? 'bg-blue-50' : 'bg-gray-50/60 hover:bg-blue-50'
                  }`}
                >
                  View all results for &ldquo;{value.trim()}&rdquo; →
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
