import clsx from 'clsx';
import type { ReactNode } from 'react';

/**
 * Heading for a card section, with an optional cluster of actions beside it.
 *
 * This exists because of one specific, repeated bug. The pattern all over the
 * app was:
 *
 *     <div className="flex items-center justify-between mb-4">
 *       <h2>Quotations</h2>
 *       <div className="flex items-center gap-2"> …four buttons… </div>
 *     </div>
 *
 * On a desktop that is fine. On a phone the row cannot fit, and because neither
 * container wraps, flex falls back to shrinking each button to its *min-content*
 * width — which for a text button means wrapping the label. That is how
 * "Creation Restrictions: OFF" rendered as three stacked lines while the last
 * button in the row still overflowed past the right edge of the card.
 *
 * The fix is two rules working together, and both are needed:
 *
 *   1. `flex-wrap` on the action cluster, so a button that does not fit moves to
 *      the next row rather than being crushed or pushed off-screen.
 *   2. `whitespace-nowrap` on the buttons themselves (see Button.tsx), so
 *      "shrink" is never satisfied by breaking the label across lines.
 *
 * Below `sm` the title takes its own row and the actions sit underneath, which
 * gives them the full card width to wrap into. From `sm` up the title and the
 * actions share one row exactly as before — desktop is unchanged.
 */
export default function SectionHeader({
  title,
  icon,
  actions,
  className,
}: {
  title: ReactNode;
  /** Rendered before the title; size it yourself (e.g. `w-5 h-5`). */
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 mb-3 sm:mb-4',
        className
      )}
    >
      <h2 className="text-sm sm:text-base font-semibold text-gray-800 flex items-center gap-1.5 min-w-0">
        {icon}
        <span className="truncate">{title}</span>
      </h2>
      {actions && (
        // `flex-wrap` is the load-bearing class here; see the note above.
        <div className="flex items-center flex-wrap gap-2 sm:flex-shrink-0">{actions}</div>
      )}
    </div>
  );
}
