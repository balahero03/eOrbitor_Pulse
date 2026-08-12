import clsx from 'clsx';
import type { ReactNode } from 'react';

/**
 * Standard list-page header: title, a one-line count, and the page actions.
 *
 * The mobile layout is the point of this component. Every list page used to
 * stack the actions onto their own full-width row below the title, so a phone
 * spent roughly a third of the first screen on a heading before a single row
 * of data appeared. Here the actions sit beside the title and size to their
 * content, which buys back that row.
 *
 * Desktop is deliberately unchanged — same `sm:` type scale, padding and
 * spacing as before.
 */
export default function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        // `items-start` on mobile keeps the buttons level with the title while
        // the subtitle drops below it; `sm:items-center` restores exactly the
        // vertical centring the old header used on desktop.
        'flex items-start sm:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-xl border border-gray-100 shadow-sm',
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-lg sm:text-2xl font-bold text-gray-900 leading-tight">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && (
        // `flex-shrink-0` keeps the buttons at their natural width and lets the
        // title truncate instead — the reverse squeezes labels onto two lines.
        <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
      )}
    </div>
  );
}
