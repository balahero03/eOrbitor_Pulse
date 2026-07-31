'use client';

import Image from 'next/image';

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
            <Image src="/icon.png" alt="eOrbitor" width={56} height={56} priority className="drop-shadow-sm" />
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
