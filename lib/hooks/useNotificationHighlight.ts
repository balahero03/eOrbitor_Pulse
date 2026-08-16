'use client';

import { useEffect, useRef, useState } from 'react';
import { HIGHLIGHT_EVENT, readPendingHighlight, HighlightRequest } from '@/lib/notificationHighlight';

// Subscribes a page to notification-driven highlights for one `scope`.
//
// Usage: give each highlightable element id={`${scope}-${itemId}`}, then
// apply highlightRingClass(flashId === itemId) to its className. The hook
// handles: catching both the mount-time pending request and the live event,
// deduping repeat/refetch triggers by nonce, retrying while the target's
// data is still loading into the DOM, smoothly scrolling it into view, and
// clearing the ring after 3s.
export function useNotificationHighlight(scope: string): string | null {
  const [flashId, setFlashId] = useState<string | null>(null);
  const processedNonce = useRef<number | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const target = useRef<{ id: string; nonce: number } | null>(null);

  useEffect(() => {
    const clearRetries = () => {
      retryTimers.current.forEach(clearTimeout);
      retryTimers.current = [];
    };

    // Try to flash the pending target. No-ops (and lets a retry catch it) if
    // the element isn't in the DOM yet because the list is still loading.
    const attempt = () => {
      const t = target.current;
      if (!t || processedNonce.current === t.nonce) return;
      const el =
        document.getElementById(`${scope}-${t.id}`) ||
        document.getElementById(`approval-${t.id}`) ||
        document.getElementById(`access-${t.id}`) ||
        document.querySelector(`[data-highlight-id="${t.id}"]`) ||
        document.querySelector(`[data-entity-id="${t.id}"]`) ||
        document.querySelector(`[data-request-id="${t.id}"]`);

      if (!el) return;
      processedNonce.current = t.nonce;
      setFlashId(t.id);
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlashId(null), 6000);
      clearRetries();
    };

    const schedule = (req: { id: string; nonce: number }) => {
      target.current = req;
      clearRetries();
      attempt();
      // The target row may render a moment after we arrive (async fetch) —
      // re-attempt across multiple intervals until it exists.
      retryTimers.current = [50, 150, 300, 600, 1000, 1600, 2400, 3500, 5000].map((ms) => setTimeout(attempt, ms));
    };

    // Case A: navigated in — the request was recorded before this page's
    // listener existed, so pick it up from the module holder on mount.
    const p = readPendingHighlight(scope);
    if (p) schedule({ id: p.id, nonce: p.nonce });

    // Case B: already on this page when the notification was clicked.
    const handler = (e: Event) => {
      const d = (e as CustomEvent<HighlightRequest>).detail;
      if (!d || d.scope !== scope) return;
      schedule({ id: d.id, nonce: d.nonce });
    };
    window.addEventListener(HIGHLIGHT_EVENT, handler);

    return () => {
      window.removeEventListener(HIGHLIGHT_EVENT, handler);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      clearRetries();
    };
  }, [scope]);

  return flashId;
}
