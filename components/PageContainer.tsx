import clsx from 'clsx';
import type { ReactNode } from 'react';

/**
 * Standard outer wrapper for a dashboard page.
 *
 * The dashboard pages had drifted into six different combinations of outer
 * padding and vertical rhythm (`p-4 sm:p-6 space-y-4 sm:space-y-6`,
 * `p-3.5 sm:p-6 space-y-4 sm:space-y-5`, and four more). Individually each is
 * defensible; together they make the content shift by a few pixels every time
 * you navigate, which reads as sloppiness even when nobody can name why.
 *
 * The values below are the ones already most common in the app.
 */
export default function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  // Tighter gutters and rhythm on a phone, unchanged from `sm` up. 16px of
  // padding either side is 8% of a 390pt screen spent on nothing, and four
  // 16px gaps between cards add up to another row of content pushed under
  // the fold.
  return <div className={clsx('p-3 sm:p-6 space-y-3 sm:space-y-5', className)}>{children}</div>;
}
