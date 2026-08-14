'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Gives a conditionally-rendered element a real close transition.
 *
 * `components/Modal.tsx` solved this for the dialogs built on it, but every
 * other popover in the app — the notification bell, the mobile sidebar scrim,
 * every hand-rolled modal that predates that component — used the same
 * `{open && <div className="animate-fade-in">…}` shape. That animates the
 * *open*, then unmounts the instant `open` flips, so the close is a jump cut:
 * one frame it's there, the next it's gone, no matter how carefully the entry
 * was animated.
 *
 * This hook is the same fix, extracted so it can be dropped into existing
 * markup without restructuring it into `<Modal>`'s header/body/footer shape.
 * Swap the render guard from `open` to `mounted`, and swap the "which
 * animation class" logic from `open ? enter : ''` to `leaving ? exit : enter`.
 *
 * @param open   Caller's intent — same boolean already driving `{open && …}`.
 * @param exitMs How long the exit animation takes. Must match the CSS
 *               duration or the element unmounts mid-animation (a visible
 *               snap) or lingers past it (an invisible-but-still-in-the-DOM
 *               delay before the next open can restart the enter animation).
 */
export function useMountTransition(open: boolean, exitMs = 180) {
  const [mounted, setMounted] = useState(open);
  const [leaving, setLeaving] = useState(false);
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
      }, exitMs);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, exitMs]);

  return { mounted, leaving };
}
