'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { WarningIcon } from './icons';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';

interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for destructive actions (delete, permanent removal, etc). */
  danger?: boolean;
}

type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface PendingConfirm extends ConfirmOptions {
  message: string;
  resolve: (value: boolean) => void;
}

// Replaces window.confirm(), which freezes the whole tab with a browser-
// chrome dialog that looks nothing like the app. Same call-and-await
// contract (`if (!(await confirm(...))) return;`) but renders as an
// on-brand modal — backdrop blur, scale-in, Escape/backdrop-click to
// cancel, and a red confirm button only when the action is destructive.
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [closing, setClosing] = useState(false);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback<ConfirmFn>((message, options) => {
    return new Promise<boolean>((resolve) => {
      setPending({ message, resolve, ...options });
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    if (!pending) return;
    setClosing(true);
    setTimeout(() => {
      pending.resolve(value);
      setPending(null);
      setClosing(false);
    }, 140);
  }, [pending]);

  useEffect(() => {
    if (!pending) return;
    confirmBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') settle(false);
      if (e.key === 'Enter') settle(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, settle]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div
            className={`absolute inset-0 bg-gray-900/40 backdrop-blur-[2px] ${closing ? 'animate-fade-out' : 'animate-fade-in'}`}
            onClick={() => settle(false)}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            className={`relative bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-sm p-5 ${closing ? 'animate-fade-out' : 'animate-scale-in'}`}
          >
            <div className="flex items-start gap-3">
              <span className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${pending.danger ? 'bg-red-50' : 'bg-blue-50'}`}>
                {pending.danger
                  ? <WarningIcon className="w-5 h-5" />
                  : <QuestionMarkCircleIcon className="w-5 h-5 text-blue-600" />}
              </span>
              <div className="min-w-0 pt-1.5">
                {pending.title && <p className="text-sm font-bold text-gray-900 mb-1">{pending.title}</p>}
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{pending.message}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => settle(false)}
                className="flex-1 px-3.5 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                {pending.cancelLabel || 'Cancel'}
              </button>
              <button
                ref={confirmBtnRef}
                onClick={() => settle(true)}
                className={`flex-1 px-3.5 py-2 rounded-lg text-sm font-semibold text-white shadow-sm transition-colors ${
                  pending.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {pending.confirmLabel || (pending.danger ? 'Delete' : 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
  return ctx;
}
