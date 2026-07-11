'use client';

import { useState, useRef, useEffect } from 'react';
import { ClockIcon } from '@heroicons/react/24/outline';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

interface TimeFieldProps {
  value: string; // '' or 'HH:MM' in 24-hour form
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string; // width/margin utilities for the outer wrapper, e.g. "w-full"
}

function clampPart(raw: string, max: number): string {
  if (!raw) return '';
  return String(Math.min(max, parseInt(raw, 10) || 0)).padStart(2, '0');
}

const segmentClass = 'w-6 text-center bg-transparent focus:outline-none disabled:text-gray-400';

// Native <input type="time"> renders in 12-hour AM/PM whenever the browser
// or OS locale is 12-hour, and there's no reliable cross-browser way to
// force 24-hour on it (the `lang` attribute only works in Firefox, not
// Chrome/Edge, which follow OS regional settings instead). This is a fully
// custom control instead — two fixed digit boxes either side of a permanent
// ':' (type the hour, it auto-advances into the minute), or pick from the
// dropdown — so the digits shown always match the stored 24-hour value.
export default function TimeField({ value, onChange, disabled, className = '' }: TimeFieldProps) {
  const [h, m] = value ? value.split(':') : ['', ''];
  const [hText, setHText] = useState(h);
  const [mText, setMText] = useState(m);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hourRef = useRef<HTMLInputElement>(null);
  const minuteRef = useRef<HTMLInputElement>(null);
  const selectedHourRef = useRef<HTMLButtonElement>(null);
  const selectedMinuteRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const [nh, nm] = value ? value.split(':') : ['', ''];
    setHText(nh);
    setMText(nm);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      selectedHourRef.current?.scrollIntoView({ block: 'nearest' });
      selectedMinuteRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [open]);

  const pick = (nh: string, nm: string) => {
    setHText(nh);
    setMText(nm);
    onChange(`${nh}:${nm}`);
  };

  const commit = (hRaw: string, mRaw: string) => {
    if (!hRaw && !mRaw) {
      onChange('');
      return;
    }
    const hh = clampPart(hRaw || '0', 23);
    const mm = clampPart(mRaw || '0', 59);
    setHText(hh);
    setMText(mm);
    onChange(`${hh}:${mm}`);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        className={`flex items-center gap-1 border rounded-lg px-2.5 py-2 text-sm ${
          disabled ? 'bg-gray-50 text-gray-400' : 'bg-white'
        }`}
      >
        <input
          ref={hourRef}
          type="text"
          inputMode="numeric"
          maxLength={2}
          placeholder="HH"
          value={hText}
          disabled={disabled}
          onFocus={e => { if (!disabled) setOpen(true); e.target.select(); }}
          onChange={e => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
            setHText(digits);
            if (digits.length === 2) { minuteRef.current?.focus(); minuteRef.current?.select(); }
          }}
          onKeyDown={e => {
            if (e.key === 'Escape') setOpen(false);
            const el = e.currentTarget;
            if (e.key === ':' || (e.key === 'ArrowRight' && el.selectionStart === el.value.length)) {
              e.preventDefault();
              minuteRef.current?.focus();
              minuteRef.current?.select();
            }
          }}
          onBlur={e => commit(e.target.value.replace(/\D/g, '').slice(0, 2), mText)}
          className={segmentClass}
          aria-label="Hour"
        />
        <span className={disabled ? 'text-gray-300' : 'text-gray-400'}>:</span>
        <input
          ref={minuteRef}
          type="text"
          inputMode="numeric"
          maxLength={2}
          placeholder="MM"
          value={mText}
          disabled={disabled}
          onFocus={e => { if (!disabled) setOpen(true); e.target.select(); }}
          onChange={e => setMText(e.target.value.replace(/\D/g, '').slice(0, 2))}
          onKeyDown={e => {
            if (e.key === 'Escape') setOpen(false);
            const el = e.currentTarget;
            if (e.key === 'Backspace' && mText === '') {
              e.preventDefault();
              hourRef.current?.focus();
              hourRef.current?.select();
            } else if (e.key === 'ArrowLeft' && el.selectionStart === 0) {
              e.preventDefault();
              hourRef.current?.focus();
              hourRef.current?.select();
            }
          }}
          onBlur={e => commit(hText, e.target.value.replace(/\D/g, '').slice(0, 2))}
          className={segmentClass}
          aria-label="Minute"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(o => !o)}
          aria-label="Open time picker"
          className="ml-auto flex-shrink-0 text-gray-400 hover:text-gray-600 disabled:text-gray-300"
        >
          <ClockIcon className="w-4 h-4" />
        </button>
      </div>

      {open && !disabled && (
        <div className="absolute top-full left-0 mt-1 flex divide-x divide-gray-100 bg-white border border-gray-200 rounded-lg shadow-lg z-20 w-32 overflow-hidden">
          <div className="flex-1 max-h-48 overflow-y-auto py-1">
            {HOURS.map(hh => (
              <button
                key={hh}
                type="button"
                ref={hh === h ? selectedHourRef : undefined}
                onClick={() => pick(hh, m || '00')}
                className={`w-full text-center text-sm px-2 py-1 hover:bg-blue-50 ${
                  hh === h ? 'bg-blue-100 font-semibold text-blue-700' : 'text-gray-700'
                }`}
              >
                {hh}
              </button>
            ))}
          </div>
          <div className="flex-1 max-h-48 overflow-y-auto py-1">
            {MINUTES.map(mm => (
              <button
                key={mm}
                type="button"
                ref={mm === m ? selectedMinuteRef : undefined}
                onClick={() => { pick(h || '00', mm); setOpen(false); }}
                className={`w-full text-center text-sm px-2 py-1 hover:bg-blue-50 ${
                  mm === m ? 'bg-blue-100 font-semibold text-blue-700' : 'text-gray-700'
                }`}
              >
                {mm}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
