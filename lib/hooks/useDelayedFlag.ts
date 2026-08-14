'use client';

import { useEffect, useState } from 'react';

/**
 * Debounces a "we're fetching" flag so it only becomes visible if the fetch
 * is actually slow.
 *
 * The list pages dim their content to 40% opacity while `refreshing` is true,
 * so a filter click doesn't tear the old rows out from under you. That's
 * correct when a fetch takes a moment — but on a fast API (or just localhost),
 * the request can resolve in under 50ms, well inside the 200ms opacity
 * transition. The dim starts animating toward 0.4, the fetch finishes, and the
 * opacity reverses back toward 1 before it ever gets there. That reversal is a
 * one-frame flicker, not a fade — a transition that never completes reads as a
 * glitch, not as "loading."
 *
 * This hook only flips to `true` once `active` has stayed true continuously
 * for `delayMs`. A fetch that resolves before the delay elapses never shows
 * anything — clean, instant, no flicker. Only a genuinely slow fetch, one
 * that's still running past the delay, gets the dim — and by then it's
 * already been running long enough that the dim reads as real feedback rather
 * than noise.
 */
export function useDelayedFlag(active: boolean, delayMs = 150): boolean {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!active) {
      setShow(false);
      return;
    }
    const timer = setTimeout(() => setShow(true), delayMs);
    // If `active` goes false before the timer fires — the common case on a
    // fast connection — this cleanup cancels it and `show` never flips.
    return () => clearTimeout(timer);
  }, [active, delayMs]);

  return show;
}
