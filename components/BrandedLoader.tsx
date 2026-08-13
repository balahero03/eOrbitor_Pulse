'use client';

import Image from 'next/image';
import clsx from 'clsx';
import GearLoader from '@/components/GearLoader';

/**
 * In-page loading state for everything except the login/logout transition.
 *
 * `BrandedLoader` below is `fixed inset-0 z-[500]` — right for an auth
 * transition, wrong for a list refetch, where it would black out the whole app
 * every time a filter changed. So in-page waits get this instead: no overlay, no
 * layout takeover. It replaces the bare "Loading..." text and the plain blue
 * spinner circles that each page had grown its own version of.
 *
 * The mark is the meshed-gear animation rather than the "e" logo — the logo mark
 * is reserved for the full-screen moment so the two states stay distinguishable.
 */
export function InlineLoader({
  message,
  size = 'md',
  className,
}: {
  message?: string;
  /** `sm` for a section inside a card, `md` for a whole page body. */
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center gap-2 animate-fade-in',
        size === 'sm' ? 'py-6' : 'py-14',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <GearLoader size={size === 'sm' ? 'sm' : 'md'} />
      {message && <p className="text-xs text-gray-400">{message}</p>}
      <span className="sr-only">Loading</span>
    </div>
  );
}

// Full-screen branded loading state — shown right after login and while the
// dashboard shell resolves its initial auth/access check. Replaces a bare
// spinner with the same "e" mark used everywhere else in the product, so the
// gap between "you logged in" and "the app is ready" feels intentional
// rather than like a stalled page.
export function BrandedLoader({ message = 'Loading your workspace…' }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-gradient-to-br from-white via-blue-50/50 to-white">
      <div className="flex flex-col items-center gap-6 animate-fade-in">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full bg-red-500/10 blur-xl animate-pulse" />
          <div
            className="absolute inset-0 rounded-full border-[3px] border-gray-100 border-t-red-500 border-r-red-500/50 animate-spin"
            style={{ animationDuration: '1000ms' }}
          />
          <div className="absolute inset-[10px] flex items-center justify-center animate-scale-in">
            {/* Two assets, deliberately different. app/icon.png is the
                favicon/PWA mark and carries an opaque white disc, which is
                right for a browser tab or home screen but would read as a
                pale coin sitting on this gradient.

                e-mark.png is the same glyph on a fully transparent ground —
                keyed off the white master logo so the red edges feather
                cleanly, rather than cut out of the dark-disc version, which
                would leave a grey halo on every light surface it lands on. */}
            <Image src="/e-mark.png" alt="eOrbitor" width={56} height={56} priority className="drop-shadow-sm" />
          </div>
        </div>
        <div
          className="text-center animate-slide-up"
          style={{ animationDelay: '100ms', animationFillMode: 'both' }}
        >
          <p className="text-lg font-bold text-gray-900 tracking-tight">
            eOrbitor <span className="text-blue-600">Pulse</span>
          </p>
          <p className="text-xs text-gray-400 mt-1.5">{message}</p>
        </div>
      </div>
    </div>
  );
}
