'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import clsx from 'clsx';
import type { ReactNode } from 'react';

/**
 * Modal shell with a real close transition.
 *
 * Every dialog in the app animated *in* and then vanished the instant its
 * `show` flag flipped, because the element unmounts before any exit animation
 * can run. Closing one modal to open another therefore read as a jump cut. This
 * keeps the panel mounted for the length of the exit animation, then unmounts —
 * so `onClose` feels like the reverse of opening.
 *
 * Also handles the things each modal was re-implementing or skipping: Escape to
 * close, a backdrop click, locking body scroll, and moving focus into the panel
 * so the keyboard doesn't stay behind on the page underneath.
 */

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
};

/** Matches the longest exit animation in tailwind.config (slide-down, 180ms). */
const EXIT_MS = 180;

export default function Modal({
  open,
  onClose,
  children,
  size = 'lg',
  /** Set false for destructive flows where a stray click shouldn't dismiss. */
  closeOnBackdrop = true,
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: keyof typeof SIZES;
  closeOnBackdrop?: boolean;
  className?: string;
}) {
  // `open` is the caller's intent; `mounted` is what's actually in the DOM.
  // They diverge for EXIT_MS so the close animation has time to play.
  const [mounted, setMounted] = useState(open);
  const [leaving, setLeaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setMounted(true);
      setLeaving(false);
    } else if (mounted) {
      setLeaving(true);
      timerRef.current = setTimeout(() => {
        setMounted(false);
        setLeaving(false);
      }, EXIT_MS);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [open, mounted]);

  // Escape closes, and body scroll is locked while a dialog is up — otherwise
  // the page behind scrolls under the panel on both desktop and touch.
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [mounted, onClose]);

  // Move focus into the panel on open so keyboard users aren't left on the page
  // behind it. Deliberately not a full focus trap — that would need to manage
  // tab cycling, and these dialogs are short.
  useEffect(() => {
    if (!mounted || leaving) return;
    const el = panelRef.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>(
      'input:not([type="hidden"]), select, textarea, [data-autofocus], button:not([aria-label="Close"]), [href]'
    );
    // rAF so the element is painted before we focus it.
    const raf = requestAnimationFrame(() => first?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(raf);
  }, [mounted, leaving]);

  const handleBackdrop = useCallback(() => {
    if (closeOnBackdrop) onClose();
  }, [closeOnBackdrop, onClose]);

  if (!mounted) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={handleBackdrop}
      className={clsx(
        'fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-gray-900/40 backdrop-blur-sm',
        leaving ? 'animate-fade-out' : 'animate-fade-in'
      )}
    >
      <div
        ref={panelRef}
        // Stop clicks inside the panel from reaching the backdrop handler.
        // mousedown rather than click, so a text selection that ends outside
        // the panel doesn't dismiss it.
        onMouseDown={e => e.stopPropagation()}
        className={clsx(
          'bg-white w-full flex flex-col shadow-2xl',
          'rounded-t-2xl sm:rounded-2xl max-h-[92vh] sm:max-h-[90vh]',
          SIZES[size],
          leaving
            ? 'animate-slide-down sm:animate-scale-out'
            : 'animate-slide-up sm:animate-scale-in',
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Sticky modal header: title, optional subtitle, close, and an optional back
 * affordance.
 *
 * `onBack` matters when one dialog opens another — without it the second panel
 * is a dead end and the only way out is Cancel, which throws away the first
 * one's context. `accent` tints the icon strip so two dialogs opened from the
 * same page don't read as the same dialog.
 */
export function ModalHeader({
  title,
  subtitle,
  onClose,
  onBack,
  backLabel = 'Back',
  icon,
  accent = 'neutral',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  onBack?: () => void;
  backLabel?: string;
  icon?: ReactNode;
  accent?: 'neutral' | 'success' | 'danger';
}) {
  const tint = {
    neutral: 'bg-gray-100 text-gray-500',
    success: 'bg-green-50 text-green-600',
    danger: 'bg-red-50 text-red-600',
  }[accent];

  return (
    <div className="border-b border-gray-100 px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors mb-2 -ml-1 px-1 py-0.5 rounded"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 15l-5-5 5-5" />
          </svg>
          {backLabel}
        </button>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {icon && (
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${tint}`}>
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">{title}</h2>
            {subtitle && <div className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</div>}
          </div>
        </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg w-8 h-8 flex items-center justify-center transition-colors flex-shrink-0 -mt-1 -mr-1 focus:outline-none"
      >
        <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M5 5l10 10M15 5L5 15" />
        </svg>
      </button>
      </div>
    </div>
  );
}

/** Sticky modal footer. `hint` sits opposite the actions on desktop. */
export function ModalFooter({ hint, children }: { hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="border-t border-gray-100 bg-gray-50/60 px-4 sm:px-6 py-3 sm:py-4 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 flex-shrink-0">
      {hint ? (
        <div className="text-xs text-gray-400 text-center sm:text-left">{hint}</div>
      ) : (
        <span className="hidden sm:block" />
      )}
      <div className="flex flex-col-reverse sm:flex-row gap-2">{children}</div>
    </div>
  );
}

/** Scrollable modal body. */
export function ModalBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('overflow-y-auto flex-1 px-4 sm:px-6 py-5', className)}>{children}</div>
  );
}
