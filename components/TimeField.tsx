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

// globals.css styles *every* `input[type="text"]` with a border, rounded
// corners and `px-3 py-2`. That selector is an element + attribute pair, which
// outranks a plain Tailwind utility class, so these two segments were each
// drawing their own bordered box *inside* this component's box — the "three
// nested boxes" look. The `!` prefixes are what actually beat that rule; without
// them the shell below is decoration around two rogue inputs.
const segmentClass =
  '!w-[2.2ch] !p-0 !border-0 !rounded-none !bg-transparent text-center tabular-nums ' +
  'font-semibold text-gray-900 focus:!outline-none focus:!ring-0 ' +
  'placeholder:font-normal placeholder:text-gray-300 disabled:!text-gray-400';

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
      {/* One shell, one border. `focus-within` moves the focus ring to the
          shell so tabbing between the hour and minute segments reads as moving
          inside a single field rather than between two controls. 40px min
          height keeps it a comfortable tap target on a phone. */}
      <div
        className={`flex items-center gap-0.5 border rounded-lg px-2.5 py-2 min-h-[40px] sm:min-h-0 text-sm transition-colors ${disabled
            ? 'bg-gray-50 border-gray-200 text-gray-400'
            : `bg-white ${open ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200'}`
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
        <span className={`font-semibold select-none ${disabled ? 'text-gray-300' : 'text-gray-400'}`}>:</span>
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
          aria-expanded={open}
          className={`ml-auto flex-shrink-0 -mr-1 p-1 rounded-md transition-colors ${disabled ? 'text-gray-300' : open ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
        >
          <ClockIcon className="w-4 h-4" />
        </button>
      </div>

      {open && !disabled && (
        // `right-0 sm:right-auto` keeps the panel inside the viewport when the
        // field sits in the right-hand column of a two-up form on a phone.
        <div className="absolute top-full left-0 right-0 sm:right-auto mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl z-20 w-full sm:w-44 overflow-hidden animate-scale-in">
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-gray-100 bg-gray-50">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex-1 text-center">Hour</span>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex-1 text-center">Min</span>
          </div>
          <div className="flex divide-x divide-gray-100">
            {/* Two independently scrolling columns. Rows are 32px so they stay
                tappable, and `scroll-smooth` stops the auto-scroll-to-selected
                on open from looking like a jump cut. */}
            <div className="flex-1 max-h-44 overflow-y-auto scroll-smooth py-1">
              {HOURS.map(hh => (
                <button
                  key={hh}
                  type="button"
                  ref={hh === h ? selectedHourRef : undefined}
                  onClick={() => pick(hh, m || '00')}
                  className={`w-full text-center text-sm px-2 py-1.5 min-h-[32px] tabular-nums transition-colors ${hh === h ? 'bg-blue-600 font-semibold text-white' : 'text-gray-700 hover:bg-blue-50'
                    }`}
                >
                  {hh}
                </button>
              ))}
            </div>
            <div className="flex-1 max-h-44 overflow-y-auto scroll-smooth py-1">
              {MINUTES.map(mm => (
                <button
                  key={mm}
                  type="button"
                  ref={mm === m ? selectedMinuteRef : undefined}
                  onClick={() => { pick(h || '00', mm); setOpen(false); }}
                  className={`w-full text-center text-sm px-2 py-1.5 min-h-[32px] tabular-nums transition-colors ${mm === m ? 'bg-blue-600 font-semibold text-white' : 'text-gray-700 hover:bg-blue-50'
                    }`}
                >
                  {mm}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-t border-gray-100 bg-gray-50">
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                pick(String(now.getHours()).padStart(2, '0'), String(now.getMinutes()).padStart(2, '0'));
                setOpen(false);
              }}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-100 transition-colors"
            >
              Now
            </button>
            <button
              type="button"
              onClick={() => { setHText(''); setMText(''); onChange(''); setOpen(false); }}
              className="text-xs font-medium text-gray-500 hover:text-red-600 px-2 py-1 rounded hover:bg-gray-200 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
