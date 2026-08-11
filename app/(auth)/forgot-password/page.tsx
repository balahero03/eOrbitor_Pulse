'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { EyeIcon, EyeSlashIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

type Stage = 'request' | 'code' | 'password' | 'done';

const CODE_LENGTH = 6;

/**
 * Six single-character boxes that behave like one field: typing advances,
 * Backspace on an empty box steps back, and a pasted code fills the row.
 * Without the paste handler the most common way people move a code across
 * from their mail client — select, copy, paste — drops five of six digits
 * into the first box.
 */
function CodeInput({
  value, onChange, disabled, onComplete,
}: {
  value: string; onChange: (v: string) => void; disabled?: boolean; onComplete?: (v: string) => void;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const setAt = (i: number, char: string) => {
    const next = (value.slice(0, i) + char + value.slice(i + 1)).slice(0, CODE_LENGTH);
    onChange(next);
    if (char && i < CODE_LENGTH - 1) refs.current[i + 1]?.focus();
    if (next.length === CODE_LENGTH && !next.includes(' ')) onComplete?.(next);
  };

  return (
    <div className="flex gap-2 justify-center" onPaste={(e) => {
      const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
      if (!digits) return;
      e.preventDefault();
      onChange(digits);
      refs.current[Math.min(digits.length, CODE_LENGTH - 1)]?.focus();
      if (digits.length === CODE_LENGTH) onComplete?.(digits);
    }}>
      {Array.from({ length: CODE_LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          value={value[i] ?? ''}
          onChange={(e) => setAt(i, e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !value[i] && i > 0) refs.current[i - 1]?.focus();
            if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
            if (e.key === 'ArrowRight' && i < CODE_LENGTH - 1) refs.current[i + 1]?.focus();
          }}
          className="w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold border border-gray-300 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
          style={{ height: '3.25rem' }}
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [stage, setStage] = useState<Stage>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [ticket, setTicket] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const requestCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(''); setNotice(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.status === 429) {
        setError(data.message || 'Too many requests. Please wait.');
        setCooldown(data.retryAfterSeconds ?? 60);
        return;
      }
      if (!res.ok) { setError(data.message || 'Something went wrong.'); return; }

      setCode('');
      setStage('code');
      setCooldown(data.resendCooldownSeconds ?? 60);
      setNotice(data.message || '');
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const submitCode = useCallback(async (submitted?: string) => {
    const value = submitted ?? code;
    if (value.length !== CODE_LENGTH) { setError('Enter all six digits.'); return; }
    setError(''); setNotice(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'That code is incorrect.');
        setCode('');
        // The challenge is gone after too many wrong tries — send them back
        // rather than leaving them typing into a code that can't succeed.
        if (data.locked) setStage('request');
        return;
      }
      setTicket(data.ticket);
      setStage('password');
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [code, email]);

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Could not reset your password.');
        if (data.restart) { setStage('request'); setCode(''); setTicket(''); }
        return;
      }
      // Every existing session was just revoked server-side; drop the local
      // token too so the app can't briefly act as if still signed in.
      localStorage.removeItem('token');
      setStage('done');
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500';
  const btnCls = 'w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gray-50">
      <div className="w-full max-w-md animate-slide-up">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-200/60 p-6 sm:p-8">
          <div className="flex justify-center mb-5">
            <Image src="/eOrbitor_logo.jpg" alt="eOrbitor Logo" width={72} height={72} className="rounded-xl shadow-sm" priority />
          </div>

          {stage !== 'done' && (
            <>
              <h1 className="text-2xl font-bold text-center text-gray-900 tracking-tight">Reset Password</h1>
              {/* Three dots rather than a label per step: the flow is short and
                  the position matters more than the names. */}
              <div className="flex items-center justify-center gap-1.5 mt-3 mb-5" aria-hidden>
                {(['request', 'code', 'password'] as Stage[]).map((s) => (
                  <span key={s} className={`h-1.5 rounded-full transition-all ${stage === s ? 'w-6 bg-blue-600' : 'w-1.5 bg-gray-200'}`} />
                ))}
              </div>
            </>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm animate-scale-in">
              {error}
            </div>
          )}

          {stage === 'request' && (
            <form onSubmit={requestCode} className="space-y-4">
              <p className="text-center text-gray-500 text-sm -mt-1">
                Enter the email you sign in with. We&apos;ll send a six-digit code to the recovery email on your account.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Login Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@eorbitor.com" required autoComplete="username" autoFocus className={inputCls} />
              </div>
              <button type="submit" disabled={loading || cooldown > 0} className={btnCls}>
                {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {cooldown > 0 ? `Wait ${cooldown}s` : loading ? 'Sending…' : 'Send Code'}
              </button>
            </form>
          )}

          {stage === 'code' && (
            <div className="space-y-4">
              <p className="text-center text-gray-500 text-sm -mt-1">
                Enter the six-digit code sent to the recovery email on your account. It expires in 10 minutes.
              </p>
              <CodeInput value={code} onChange={setCode} disabled={loading} onComplete={(v) => submitCode(v)} />
              <button type="button" onClick={() => submitCode()} disabled={loading || code.length !== CODE_LENGTH} className={btnCls}>
                {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {loading ? 'Verifying…' : 'Verify Code'}
              </button>
              <div className="flex items-center justify-between text-xs pt-1">
                <button type="button" onClick={() => { setStage('request'); setCode(''); setError(''); }}
                  className="text-gray-500 hover:text-gray-800 transition-colors">
                  ← Use a different email
                </button>
                <button type="button" onClick={() => requestCode()} disabled={cooldown > 0 || loading}
                  className="text-blue-600 hover:underline font-medium disabled:text-gray-400 disabled:no-underline">
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 text-center leading-relaxed pt-1">
                No code? Your account may not have a verified recovery email yet — ask your administrator to reset your password.
              </p>
            </div>
          )}

          {stage === 'password' && (
            <form onSubmit={submitPassword} className="space-y-4">
              <p className="text-center text-gray-500 text-sm -mt-1">Choose a new password.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={password}
                    onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required
                    autoComplete="new-password" autoFocus className={`${inputCls} pr-10`} />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 transition-colors">
                    {showPassword ? <EyeSlashIcon className="w-[18px] h-[18px]" /> : <EyeIcon className="w-[18px] h-[18px]" />}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">At least 8 characters. Avoid your name or email.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm New Password</label>
                <input type={showPassword ? 'text' : 'password'} value={confirm}
                  onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" required
                  autoComplete="new-password" className={inputCls} />
              </div>
              <button type="submit" disabled={loading} className={btnCls}>
                {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {loading ? 'Saving…' : 'Set New Password'}
              </button>
            </form>
          )}

          {stage === 'done' && (
            <div className="text-center">
              <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h1 className="text-xl font-bold text-gray-900">Password Changed</h1>
              <p className="text-sm text-gray-500 mt-2 mb-6">
                You&apos;ve been signed out on all devices. Sign in with your new password.
              </p>
              <button onClick={() => router.push('/login')} className={btnCls}>Go to Login</button>
            </div>
          )}

          {stage !== 'done' && (
            <p className="text-center text-xs text-gray-400 mt-6">
              <Link href="/login" className="text-blue-600 hover:underline font-medium">← Back to Login</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
