'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Pos = { top?: number; bottom?: number; left?: number; right?: number };

/**
 * Renders `children` into document.body, positioned in fixed viewport
 * coordinates against `anchorRef`'s bounding box, instead of as a plain
 * `position: absolute` child.
 *
 * Any row-action dropdown rendered inside a horizontally-scrollable table
 * (`overflow-x-auto`) needs this: setting overflow-x to anything but
 * 'visible' makes the browser also clip the y-axis (that's the CSS
 * overflow spec, not a bug in the table), so a plain absolute panel gets
 * silently cut off — the trigger button still toggles (chevron flips) but
 * the menu itself is invisible or sliced to a sliver. Portaling out of that
 * ancestor sidesteps the clipping entirely.
 *
 * It also flips to open *above* the trigger when there isn't enough room
 * below (e.g. the last row of a table near the bottom of the viewport) —
 * done in two passes: place it below as a first guess, measure the panel's
 * real rendered height once it exists in the DOM, then correct if it would
 * overflow. Both passes run inside useLayoutEffect, which fires before the
 * browser paints, so this reads as one placement, not a visible jump.
 *
 * Pass `panelRef` down to the caller's own outside-click handler — the
 * portaled panel is no longer a DOM descendant of the trigger, so a ref
 * check against just the trigger wrapper would treat clicks inside the
 * menu as "outside" and close it immediately.
 */
export function DropdownPortal({
  anchorRef,
  open,
  align = 'right',
  panelRef: externalPanelRef,
  className = '',
  children,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  align?: 'left' | 'right';
  panelRef?: React.Ref<HTMLDivElement>;
  className?: string;
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState<Pos | null>(null);
  const panelElRef = useRef<HTMLDivElement | null>(null);
  const GAP = 6;
  const EDGE_MARGIN = 8;

  // Pass 1: place it below the trigger (the common case) as soon as it
  // opens, and keep it glued to the trigger on scroll/resize.
  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setPos(null);
      return;
    }
    const update = () => {
      if (!anchorRef.current) return;
      const r = anchorRef.current.getBoundingClientRect();
      // A caller commonly mounts two copies of the same trigger for
      // responsive layouts (a mobile-card version and a desktop-table
      // version, toggled with `hidden md:block` / `block md:hidden`) and
      // drives both off one shared "which row is open" bit of state. The
      // copy that's currently `display:none` still mounts and can still be
      // told `open`, but its rect collapses to all-zero — rendering it
      // anyway used to be harmless (a real `position:absolute` child stays
      // hidden with its `display:none` ancestor), but a portal escapes that
      // ancestor and would float to a bogus off-screen spot. Skip it.
      if (r.width === 0 && r.height === 0) { setPos(null); return; }
      const horiz: Pos = align === 'right'
        ? { right: Math.max(EDGE_MARGIN, window.innerWidth - r.right) }
        : { left: Math.max(EDGE_MARGIN, r.left) };

      // If we already know the panel's real height from a previous
      // measurement, decide the side up front instead of guessing below
      // and correcting a frame later.
      const knownHeight = panelElRef.current?.offsetHeight;
      const spaceBelow = window.innerHeight - r.bottom - GAP;
      const spaceAbove = r.top - GAP;
      const openUpward = knownHeight != null && knownHeight > spaceBelow && spaceAbove > spaceBelow;

      setPos(openUpward
        ? { bottom: Math.max(EDGE_MARGIN, window.innerHeight - r.top + GAP), ...horiz }
        : { top: r.bottom + GAP, ...horiz });
    };
    update();
    // capture:true so this also fires for scroll on the table's own
    // overflow-x-auto container, not just window-level scrolling — keeps
    // the panel glued to the button as the table scrolls horizontally.
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, anchorRef]);

  // Pass 2: now that the panel is actually in the DOM (from pass 1), measure
  // its real height and flip it above the trigger if it doesn't fit below —
  // e.g. the last couple of rows in a table near the bottom of the screen.
  useLayoutEffect(() => {
    if (!open || !pos || pos.bottom != null || !panelElRef.current || !anchorRef.current) return;
    const panelHeight = panelElRef.current.offsetHeight;
    const r = anchorRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom - GAP;
    const spaceAbove = r.top - GAP;
    if (panelHeight > spaceBelow && spaceAbove > spaceBelow) {
      setPos((p) => (p ? { ...p, top: undefined, bottom: Math.max(EDGE_MARGIN, window.innerHeight - r.top + GAP) } : p));
    }
    // Deliberately only depends on `pos` itself (not panelHeight, which
    // isn't state) — this runs once per placement to correct it, not on
    // every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pos]);

  if (!open || !pos || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={(node) => {
        panelElRef.current = node;
        if (typeof externalPanelRef === 'function') externalPanelRef(node);
        else if (externalPanelRef && typeof externalPanelRef === 'object') {
          (externalPanelRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }
      }}
      className={`fixed z-[200] ${className}`}
      style={{ top: pos.top, bottom: pos.bottom, left: pos.left, right: pos.right }}
    >
      {children}
    </div>,
    document.body,
  );
}
