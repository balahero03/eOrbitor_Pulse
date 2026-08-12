'use client';

import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * The one place button styling is decided.
 *
 * Before this, the same primary button had drifted into eight padding
 * combinations and three corner radii across the app, because every page
 * re-typed the class string by hand. The colours below are the ones already
 * in use — nothing here restyles anything, it just stops the sizes wandering.
 *
 * Buttons are not always `<button>`: plenty of them are `<Link>` or `<a>`
 * ("+ New Lead" navigates rather than submits). So the class builder is
 * exported on its own and the component is a thin wrapper over it — a link
 * gets `className={buttonClasses({ variant: 'primary' })}` and comes out
 * identical to a real button.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'danger';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon';

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-lg transition-colors ' +
  'disabled:opacity-50 disabled:cursor-not-allowed ' +
  // A button is a label, not a paragraph. Without this, a flex toolbar squeezes
  // its children to min-content and the text wraps inside them — which is how
  // "Creation Restrictions: OFF" became three stacked lines on a phone.
  'whitespace-nowrap ' +
  // Never let a button be the thing that widens the page. Combined with
  // `flex-wrap` on the toolbar, a button that cannot fit moves to the next row
  // instead of overflowing off the right edge.
  'max-w-full ' +
  // Keyboard users could not previously see where they were; the ring only
  // shows for keyboard focus, so mouse clicks look exactly as they did.
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white font-semibold shadow-sm hover:bg-blue-700 focus-visible:ring-blue-500',
  secondary:
    'bg-white border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 hover:border-gray-300 focus-visible:ring-gray-400',
  danger: 'bg-red-600 text-white font-semibold shadow-sm hover:bg-red-700 focus-visible:ring-red-500',
};

// `min-h-*` is the mobile tap target, and it is the only thing these sizes add
// on top of the paddings that were already here. A `py-1.5 text-xs` control is
// about 26px tall — comfortably under the ~44px both Apple and Android ask for,
// and small enough that a thumb misses it. The min-heights below are lifted on
// touch and released at `sm`, so on a desktop every button keeps the exact
// height it has today.
const SIZES: Record<ButtonSize, string> = {
  /** Dense toolbars and inline row actions. */
  xs: 'px-2.5 py-1.5 text-xs min-h-[32px] sm:min-h-0',
  // `text-xs sm:text-sm` on the two toolbar sizes is deliberate — it is what
  // the list-page headers already use to survive a narrow phone.
  sm: 'px-3 py-1.5 text-xs sm:text-sm min-h-[36px] sm:min-h-0',
  md: 'px-4 py-2 text-xs sm:text-sm min-h-[40px] sm:min-h-0',
  /** Full-width form submits and modal actions. */
  lg: 'px-4 py-2.5 text-sm min-h-[44px] sm:min-h-0',
  /** Square icon-only control; pass an aria-label. */
  icon: 'p-2 text-xs min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0',
};

export function buttonClasses(opts?: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}): string {
  const { variant = 'primary', size = 'md', fullWidth, className } = opts ?? {};
  return clsx(BASE, VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
  children?: ReactNode;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  loading,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          className={clsx(
            'w-4 h-4 border-2 rounded-full animate-spin',
            variant === 'secondary'
              ? 'border-gray-300 border-t-gray-600'
              : 'border-white/40 border-t-white'
          )}
        />
      )}
      {children}
    </button>
  );
}
