'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  title?: string;
  message: string;
  duration?: number;
  action?: ToastAction;
}

export type ToastInput = string | ToastOptions;

interface ToastItem {
  id: number;
  type: ToastType;
  title?: string;
  message: string;
  duration: number;
  action?: ToastAction;
  createdAt: number;
}

export interface ToastContextValue {
  success: (input: ToastInput, durationMs?: number) => void;
  error: (input: ToastInput, durationMs?: number) => void;
  warning: (input: ToastInput, durationMs?: number) => void;
  info: (input: ToastInput, durationMs?: number) => void;
  custom: (type: ToastType, input: ToastInput, durationMs?: number) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

interface StyleConfig {
  gradient: string;
  glowColor: string;
  ringColor: string;
  accentBar: string;
  defaultTitle: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STYLES: Record<ToastType, StyleConfig> = {
  success: {
    gradient: 'from-emerald-500 to-teal-600',
    glowColor: 'shadow-emerald-500/20',
    ringColor: 'ring-emerald-500/15 bg-emerald-50/70 text-emerald-600',
    accentBar: 'from-emerald-500 to-teal-500',
    defaultTitle: 'Success',
    icon: CheckCircleIcon,
  },
  error: {
    gradient: 'from-rose-500 to-red-600',
    glowColor: 'shadow-rose-500/20',
    ringColor: 'ring-rose-500/15 bg-rose-50/70 text-rose-600',
    accentBar: 'from-rose-500 to-red-500',
    defaultTitle: 'Error',
    icon: ExclamationCircleIcon,
  },
  warning: {
    gradient: 'from-amber-500 to-orange-600',
    glowColor: 'shadow-amber-500/20',
    ringColor: 'ring-amber-500/15 bg-amber-50/70 text-amber-600',
    accentBar: 'from-amber-500 to-orange-500',
    defaultTitle: 'Warning',
    icon: ExclamationTriangleIcon,
  },
  info: {
    gradient: 'from-blue-500 to-indigo-600',
    glowColor: 'shadow-blue-500/20',
    ringColor: 'ring-blue-500/15 bg-blue-50/70 text-blue-600',
    accentBar: 'from-blue-500 to-indigo-500',
    defaultTitle: 'Information',
    icon: InformationCircleIcon,
  },
};

function ToastCard({
  toast,
  onDismiss,
  isLeaving,
}: {
  toast: ToastItem;
  onDismiss: (id: number) => void;
  isLeaving: boolean;
}) {
  const [isPaused, setIsPaused] = useState(false);
  const remainingTimeRef = useRef(toast.duration);
  const startTimeRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const style = STYLES[toast.type];
  const Icon = style.icon;

  // Handle pause on hover
  const handleMouseEnter = () => {
    setIsPaused(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      const elapsed = Date.now() - startTimeRef.current;
      remainingTimeRef.current = Math.max(remainingTimeRef.current - elapsed, 500);
    }
  };

  const handleMouseLeave = () => {
    setIsPaused(false);
    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      onDismiss(toast.id);
    }, remainingTimeRef.current);
  };

  useEffect(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`pointer-events-auto group relative w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 p-3.5 sm:p-4 shadow-[0_12px_36px_-6px_rgba(15,23,42,0.14),0_4px_12px_-2px_rgba(15,23,42,0.06)] backdrop-blur-xl transition-all duration-200 ease-out hover:shadow-[0_16px_44px_-6px_rgba(15,23,42,0.18)] ${
        isLeaving ? 'animate-fade-out scale-95 opacity-0' : 'animate-slide-in-right'
      }`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        {/* Glowing Gradient Icon Pod */}
        <div
          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ring-1 shadow-sm transition-transform duration-200 group-hover:scale-105 ${style.ringColor} ${style.glowColor}`}
        >
          <Icon className="h-5 w-5 stroke-[2.2]" />
        </div>

        {/* Content Body */}
        <div className="min-w-0 flex-1 pt-0.5">
          {toast.title ? (
            <>
              <h4 className="text-sm font-semibold tracking-tight text-slate-900 leading-snug">
                {toast.title}
              </h4>
              <p className="mt-0.5 text-[13px] text-slate-600 leading-relaxed break-words">
                {toast.message}
              </p>
            </>
          ) : (
            <p className="text-sm font-medium text-slate-800 leading-snug break-words">
              {toast.message}
            </p>
          )}

          {/* Action button if present */}
          {toast.action && (
            <div className="mt-2.5 flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toast.action?.onClick();
                  onDismiss(toast.id);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all duration-150 hover:bg-slate-800 active:scale-95"
              >
                {toast.action.label}
              </button>
            </div>
          )}
        </div>

        {/* Close Button */}
        <button
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
          className="flex-shrink-0 -mr-1 -mt-1 rounded-lg p-1.5 text-slate-400 opacity-70 transition-all hover:bg-slate-100 hover:text-slate-700 hover:opacity-100 active:scale-90"
        >
          <XMarkIcon className="h-4 w-4 stroke-[2]" />
        </button>
      </div>

      {/* Modern Gradient Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-slate-100/80 overflow-hidden">
        <div
          className={`h-full w-full origin-left bg-gradient-to-r ${style.accentBar} animate-toast-progress`}
          style={{
            animationDuration: `${toast.duration}ms`,
            animationPlayState: isPaused ? 'paused' : 'running',
          }}
        />
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [leaving, setLeaving] = useState<Set<number>>(new Set());
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setLeaving((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      setLeaving((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 180);
  }, []);

  const push = useCallback(
    (type: ToastType, input: ToastInput, durationMs?: number) => {
      const id = ++idRef.current;
      let title: string | undefined;
      let message: string;
      let duration: number;
      let action: ToastAction | undefined;

      if (typeof input === 'string') {
        message = input;
        duration = durationMs ?? (type === 'error' ? 5500 : 4200);
      } else {
        title = input.title;
        message = input.message;
        duration = input.duration ?? durationMs ?? (type === 'error' ? 5500 : 4200);
        action = input.action;
      }

      const item: ToastItem = {
        id,
        type,
        title,
        message,
        duration,
        action,
        createdAt: Date.now(),
      };

      // Keep max 5 active toasts to prevent viewport clutter
      setToasts((prev) => [...prev.slice(-4), item]);
    },
    [],
  );

  const value: ToastContextValue = {
    success: useCallback((m, d) => push('success', m, d), [push]),
    error: useCallback((m, d) => push('error', m, d), [push]),
    warning: useCallback((m, d) => push('warning', m, d), [push]),
    info: useCallback((m, d) => push('info', m, d), [push]),
    custom: useCallback((t, m, d) => push(t, m, d), [push]),
    dismiss,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast viewport banner container */}
      <div
        className="fixed top-4 right-3 sm:right-5 z-[250] flex flex-col gap-2.5 w-[calc(100vw-1.5rem)] sm:w-96 max-w-sm pointer-events-none transition-all"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <ToastCard
            key={t.id}
            toast={t}
            onDismiss={dismiss}
            isLeaving={leaving.has(t.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
