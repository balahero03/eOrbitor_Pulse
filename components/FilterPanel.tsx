'use client';

import clsx from 'clsx';
import { useState, type ReactNode } from 'react';

/**
 * Filter fields that collapse on a phone and stay open on a desktop.
 *
 * A filter card costs three or four rows — labels, inputs, an apply button.
 * On a laptop that is free real estate beside the content. On a phone it sat
 * between the user and the list they opened the page to read, every time,
 * whether or not they intended to filter anything.
 *
 * So below `sm` the fields hide behind a summary bar and the count of active
 * filters travels on the button, which is how a phone user knows the list is
 * filtered without the controls being permanently on screen. From `sm` up the
 * bar disappears and the fields are always visible, exactly as before —
 * desktop behaviour is unchanged.
 */
export default function FilterPanel({
  children,
  activeCount = 0,
  onClear,
  label = 'Filters',
  className,
}: {
  children: ReactNode;
  /** Number of filters currently applied; shown as a badge when collapsed. */
  activeCount?: number;
  onClear?: () => void;
  /**
   * Collapsed-bar wording. Pages whose search box lives inside the panel
   * should say so — "Filters" hiding a search field is a small lie that
   * costs someone a hunt for it.
   */
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={clsx(
        'bg-white rounded-xl border border-gray-200 shadow-sm max-w-full overflow-hidden',
        // No padding around the collapsed bar on mobile; the bar supplies its
        // own, so a shut panel is one compact row rather than a padded box.
        open ? 'p-3.5 sm:p-4' : 'p-0 sm:p-4',
        className
      )}
    >
      <div className="sm:hidden">
        <div className={clsx('flex items-center gap-2', open && 'mb-3')}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className={clsx(
              'flex-1 flex items-center justify-center gap-1.5 px-3 text-sm font-semibold transition-colors',
              open ? 'py-0 text-gray-900' : 'py-2.5 text-gray-700'
            )}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"
              />
            </svg>
            {label}
            {activeCount > 0 && (
              <span className="bg-blue-600 text-white rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold">
                {activeCount}
              </span>
            )}
            <span className={clsx('ml-0.5 transition-transform text-gray-400', open && 'rotate-180')}>▾</span>
          </button>
          {activeCount > 0 && onClear && (
            <button
              type="button"
              onClick={onClear}
              className={clsx('text-xs text-gray-500 hover:text-red-600 underline pr-3', !open && 'py-2.5')}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className={clsx(open ? 'block' : 'hidden', 'sm:block')}>{children}</div>
    </div>
  );
}
