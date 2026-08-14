'use client';

import clsx from 'clsx';
import { forwardRef, type InputHTMLAttributes } from 'react';

/**
 * Numeric input for money, quantities and percentages.
 *
 * Exists because the same three defects were being fixed by hand — or, more
 * often, not fixed at all — across thirty-odd inputs:
 *
 *   1. **The stuck leading zero.** A field seeded from a Prisma `Decimal`
 *      arrives as the string "0". Typing 5 gives "05", and the value the user
 *      sees is not the value they meant. Nine inputs had a copy-pasted
 *      `replace(/^0+(?=\d)/, '')` to deal with this; the other twenty-five
 *      still showed the zero.
 *
 *   2. **Scroll-wheel edits.** A focused `type="number"` changes its value when
 *      the wheel passes over it. On a long form this silently rewrites an
 *      amount the user already filled in, and nothing on screen says so.
 *      Blurring on wheel is the standard defence.
 *
 *   3. **Append-instead-of-replace.** Clicking into a field showing "0" puts
 *      the caret beside the zero rather than selecting it, so the first
 *      keystroke extends the old value instead of replacing it.
 *
 * `type="number"` is kept deliberately: it gives phones the numeric keypad.
 *
 * It *is* caught by the blanket input rule in globals.css, though — that
 * selector list includes `input[type="number"]` explicitly. Being an
 * element+attribute selector it scores 0,1,1 and outranks a Tailwind utility
 * class at 0,1,0, so it silently won the padding for the prefix/suffix and
 * every `₹`/`%` sat directly on top of the first digit. Hence the `!` markers
 * on the padding below — the same fix TimeField needed against the same rule.
 */

export interface NumberFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  /** Held as a string so an empty field stays empty rather than collapsing to 0. */
  value: string | number;
  onChange: (value: string) => void;
  /** Rendered inside the field, e.g. "₹" or "%". */
  prefix?: string;
  suffix?: string;
  /** Styling for the input itself. Do **not** put width here — see below. */
  className?: string;
  /**
   * Sizing for the outer wrapper, e.g. `w-20`.
   *
   * Width belongs here rather than on `className` because the project has no
   * `tailwind-merge`: passing `w-20` alongside the input's own `w-full` leaves
   * two live width rules whose winner is decided by their order in the
   * generated stylesheet, not by the order written on the element. Keeping the
   * input unconditionally `w-full` inside a wrapper you size makes that
   * ambiguity impossible.
   */
  wrapperClassName?: string;
}

/**
 * Drop a leading zero once a real digit follows it ("05" → "5"), while leaving
 * "0", "0.5" and "" alone — those are all things a user legitimately means.
 */
export function stripLeadingZeros(raw: string): string {
  return raw.replace(/^0+(?=\d)/, '');
}

const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(function NumberField(
  { value, onChange, prefix, suffix, className, wrapperClassName, onFocus, onWheel, disabled, ...rest },
  ref
) {
  return (
    <div className={clsx('relative', wrapperClassName)}>
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
          {prefix}
        </span>
      )}
      <input
        ref={ref}
        type="number"
        inputMode="decimal"
        value={value}
        disabled={disabled}
        onChange={e => onChange(stripLeadingZeros(e.target.value))}
        onFocus={e => {
          // Select rather than place a caret, so the first keystroke replaces
          // the seeded value instead of extending it.
          e.target.select();
          onFocus?.(e);
        }}
        onWheel={e => {
          // Give up focus so the page scrolls and the value does not change.
          (e.target as HTMLInputElement).blur();
          onWheel?.(e);
        }}
        className={clsx(
          'w-full border rounded-lg py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50 disabled:text-gray-400',
          // `!` because globals.css's `input[type="number"]` rule sets px-3 at
          // a higher specificity; without it the value renders under the affix.
          prefix ? '!pl-7' : '!pl-3',
          suffix ? '!pr-8' : '!pr-3',
          className
        )}
        {...rest}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
});

export default NumberField;
