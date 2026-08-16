'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { SuccessIcon, ErrorIcon, WarningIcon } from './icons';
import { InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  duration: number;
}

interface ToastContextValue {
  success: (message: string, durationMs?: number) => void;
  error: (message: string, durationMs?: number) => void;
  warning: (message: string, durationMs?: number) => void;
  info: (message: string, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const STYLES: Record<ToastType, { border: string; icon: React.ComponentType<{ className?: string }>; bar: string }> = {
  success: { border: 'border-l-green-500', icon: SuccessIcon, bar: 'bg-green-500' },
  error: { border: 'border-l-red-500', icon: ErrorIcon, bar: 'bg-red-500' },
  warning: { border: 'border-l-amber-500', icon: WarningIcon, bar: 'bg-amber-500' },
  info: { border: 'border-l-blue-500', icon: InformationCircleIcon, bar: 'bg-blue-500' },
};

// A native alert() blocks the whole tab until dismissed, which reads as
// dated next to everything else in the app. This is a drop-in replacement:
// a stack of auto-dismissing, swipeable-by-nature toast cards in the
// corner, colour-coded by outcome instead of one uniform browser dialog.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [leaving, setLeaving] = useState<Set<number>>(new Set());
  const idRef = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setLeaving((prev) => new Set(prev).add(id));
    const t = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      setLeaving((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }, 160);
    timers.current.set(id, t);
  }, []);

  const push = useCallback((type: ToastType, message: string, durationMs = 4200) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, type, message, duration: durationMs }]);
    const t = setTimeout(() => dismiss(id), durationMs);
    timers.current.set(id, t);
  }, [dismiss]);

  const value: ToastContextValue = {
    success: (m, d) => push('success', m, d),
    error: (m, d) => push('error', m, d ?? 5200),
    warning: (m, d) => push('warning', m, d),
    info: (m, d) => push('info', m, d),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm pointer-events-none">
        {toasts.map((t) => {
          const style = STYLES[t.type];
          const Icon = style.icon;
          const isLeaving = leaving.has(t.id);
          return (
            <div
              key={t.id}
              className={`pointer-events-auto relative overflow-hidden bg-white rounded-xl shadow-lg border border-gray-200 border-l-4 ${style.border} ${isLeaving ? 'animate-fade-out' : 'animate-slide-in-right'}`}
            >
              <div className="flex items-start gap-2.5 px-3.5 py-3 pr-9">
                <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-800 font-medium leading-snug break-words">{t.message}</p>
              </div>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="absolute top-2.5 right-2.5 p-0.5 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
              <div
                className={`absolute bottom-0 left-0 h-0.5 w-full origin-left ${style.bar} animate-toast-progress`}
                style={{ animationDuration: `${t.duration}ms` }}
              />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
