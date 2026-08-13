'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { InlineLoader } from '@/components/BrandedLoader';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [status, setStatus] = useState<'checking' | 'success' | 'error'>('checking');
  const [message, setMessage] = useState('');
  // The link may be opened on the same device the person is already signed
  // in on (most common case) — send them back to their Profile rather than
  // the login screen if so.
  const [continueHref, setContinueHref] = useState('/login');

  useEffect(() => {
    setContinueHref(localStorage.getItem('token') ? '/profile' : '/login');

    if (!token) {
      setStatus('error');
      setMessage('This link is missing its verification token.');
      return;
    }

    fetch('/api/profile/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setStatus('error');
          setMessage(data.message || 'Failed to verify email');
          return;
        }
        setStatus('success');
        setMessage(data.message || 'Your email has been verified.');
      })
      .catch((err) => {
        console.error(err);
        setStatus('error');
        setMessage('An error occurred. Please try again.');
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gray-50">
      <div className="w-full max-w-md animate-slide-up">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-200/60 p-6 sm:p-8 text-center">
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

          {status === 'checking' && (
            <>
              <InlineLoader message="Verifying your email…" />
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h1 className="text-xl font-bold text-gray-900">Email Verified</h1>
              <p className="text-sm text-gray-500 mt-2 mb-6">{message}</p>
              <Link href={continueHref} className="block w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-blue-700 transition-colors">
                Continue
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircleIcon className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <h1 className="text-xl font-bold text-gray-900">Verification Failed</h1>
              <p className="text-sm text-gray-500 mt-2 mb-6">{message}</p>
              <Link href={continueHref} className="block w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-blue-700 transition-colors">
                {continueHref === '/profile' ? 'Go to Profile' : 'Go to Login'}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <InlineLoader />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
