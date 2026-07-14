// Shared "highlight the thing a notification points to" plumbing.
//
// When a notification is clicked, the layout's handler navigates to the
// target page and then asks that page to scroll to + briefly ring the
// specific item (a task row, an approval row, a lead's main card, etc.).
//
// Two delivery paths, because the target page might be mounted already or
// might mount a beat later from the navigation:
//   1. A DOM CustomEvent — caught by pages already on screen.
//   2. A module-level `pending` holder — read by a page as it mounts, for
//      the just-navigated case (the event alone would fire before the new
//      page's listener exists and be missed).
// A monotonic nonce lets a page treat re-clicking the *same* notification as
// a fresh trigger (React would otherwise dedupe an identical state update),
// and a freshness window stops a stale request from re-flashing if the user
// simply revisits the page later.

export const HIGHLIGHT_EVENT = 'eorbitor:highlight';
export const HIGHLIGHT_TTL_MS = 5000;

export interface HighlightRequest {
  scope: string; // which page listens: 'lead' | 'order' | 'customer' | 'user' | 'task' | 'approval' | 'quotation'
  id: string; // the element id suffix — pages render id={`${scope}-${id}`}
  nonce: number;
  at: number;
}

let pending: HighlightRequest | null = null;
let counter = 0;

// Called from the notification click handler. Records the request and pokes
// any page that's already listening.
export function requestHighlight(scope: string, id: string) {
  counter += 1;
  pending = { scope, id, nonce: counter, at: Date.now() };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(HIGHLIGHT_EVENT, { detail: pending }));
  }
}

// Called by a page as it mounts, to pick up a request that was issued while
// it was still loading. Only returns a fresh request for its own scope.
export function readPendingHighlight(scope: string): HighlightRequest | null {
  if (pending && pending.scope === scope && Date.now() - pending.at < HIGHLIGHT_TTL_MS) {
    return pending;
  }
  return null;
}

// One ring treatment for every highlight, so all pages flash identically.
// `active` true → solid ring; false → transitions out smoothly over 1.5s
// (an explicit transparent ring, not a bare class removal, so it fades).
// For bordered card/`<div>` targets.
export function highlightRingClass(active: boolean): string {
  return `transition-all duration-[1500ms] ease-out ${
    active ? 'ring-2 ring-blue-400 border-blue-300 shadow-md' : 'ring-0 ring-transparent'
  }`;
}

// Box-shadow rings render unreliably on <tr> elements (border-collapse), so
// table rows flash with a background tint that eases out over the same 1.5s.
export function highlightRowClass(active: boolean): string {
  return `transition-colors duration-[1500ms] ease-out ${active ? 'bg-blue-100' : ''}`;
}
