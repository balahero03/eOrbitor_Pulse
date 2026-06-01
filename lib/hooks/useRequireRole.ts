'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from './useCurrentUser';

export function useRequireRole(allowedRoles: string[]) {
  const { user, loading } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && !allowedRoles.includes(user.role)) {
      router.replace('/dashboard');
    }
  }, [user, loading, allowedRoles, router]);

  return { user, loading };
}
