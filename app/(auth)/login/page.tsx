'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { BrandedLoader } from '@/components/BrandedLoader';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Distinct from `loading` (the button's own spinner): this covers the
  // branded transition into the dashboard once auth has actually succeeded.
  const [entering, setEntering] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Login failed');
        setLoading(false);
        return;
      }

      localStorage.setItem('token', data.token);
      setEntering(true);
      // A client-side transition (no full reload/white-flash) into a shell
      // that shows the same branded loader while it fetches the user —
      // held for a beat so the animation reads as intentional rather than
      // a flicker on a fast connection.
      setTimeout(() => router.push('/dashboard'), 650);
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error(err);
      setLoading(false);
    }
  };

  if (entering) return <BrandedLoader message="Signing you in…" />;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-blue-50 via-white to-gray-100">
      <div className="w-full max-w-md animate-slide-up">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-200/60 p-6 sm:p-8">
          {/* Logo */}
          <div className="flex justify-center mb-5">
            <Image
              src="/eOrbitor_logo.jpg"
              alt="eOrbitor Logo"
              width={72}
              height={72}
              className="rounded-xl shadow-sm"
              priority
            />
          </div>

          <h1 className="text-2xl font-bold text-center text-gray-900 tracking-tight">eOrbitor Pulse</h1>
          <p className="text-center text-gray-500 text-sm mt-1 mb-6">Enterprise CRM Platform</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm animate-scale-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@eorbitor.com"
                required
                autoComplete="email"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full px-3.5 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeSlashIcon className="w-[18px] h-[18px]" /> : <EyeIcon className="w-[18px] h-[18px]" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {loading ? 'Signing in…' : 'Login'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            Contact your administrator if you don't have an account.
          </p>
        </div>
      </div>
    </div>
  );
}
