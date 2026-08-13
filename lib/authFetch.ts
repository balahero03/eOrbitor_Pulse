'use client';

/**
 * `fetch` that notices an expired session.
 *
 * Pages call the API directly with the localStorage token and handle failures
 * with `if (!res.ok) return` or a bare `catch {}`. That is fine for a genuine
 * error, but a 401 means the JWT has expired — and swallowing it leaves the
 * user staring at a page that has simply stopped loading data, with no
 * indication that they need to sign in again. Tokens last 30 days, so this is
 * rare and therefore especially confusing when it happens.
 *
 * On a 401 this clears the dead token and sends the browser to the login page
 * with a flag the login screen can use to explain why.
 */

let redirecting = false;

/** Attaches the bearer token and handles 401 centrally. */
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers = new Headers(init.headers as HeadersInit | undefined);
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(input, { ...init, headers });

  if (res.status === 401 && typeof window !== 'undefined') {
    handleExpiredSession();
  }
  return res;
}

/**
 * Clear the session and bounce to login.
 *
 * Guarded by a module-level flag: a page that fires several requests in
 * parallel would otherwise trigger one redirect per in-flight 401, and the
 * duplicates stack history entries so Back becomes unusable.
 */
export function handleExpiredSession() {
  if (redirecting) return;
  redirecting = true;
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  } catch {
    /* private mode — the redirect still matters */
  }
  const here = window.location.pathname + window.location.search;
  // `next` lets login return the user to what they were looking at.
  window.location.href = `/login?expired=1&next=${encodeURIComponent(here)}`;
}

/**
 * Patch `window.fetch` for the lifetime of the dashboard so *every* API call
 * gets the 401 handling, not just the ones written against `authFetch`.
 *
 * Retrofitting ~30 pages of hand-rolled `fetch(...)` calls would be a large,
 * risky diff for a behaviour that should be uniform anyway; one interceptor in
 * the shell covers them all, including future ones.
 *
 * Only same-origin `/api/...` responses are inspected, so an outbound request
 * to a third party that happens to 401 cannot log the user out.
 */
export function installSessionExpiryInterceptor(): () => void {
  if (typeof window === 'undefined') return () => {};

  const original = window.fetch;
  // Guard against double-installing under React StrictMode's remount.
  if ((window.fetch as any).__eoPatched) return () => {};

  const patched: typeof window.fetch = async (input, init) => {
    const res = await original(input, init);
    try {
      const url =
        typeof input === 'string' ? input
        : input instanceof URL ? input.pathname
        : (input as Request).url;
      const path = url.startsWith('http') ? new URL(url).pathname : url;
      // /api/auth/login answers 401 for a wrong password — that is a failed
      // sign-in, not an expired session, and must not trigger a redirect.
      if (res.status === 401 && path.startsWith('/api/') && !path.startsWith('/api/auth/login')) {
        handleExpiredSession();
      }
    } catch {
      /* never let the interceptor break a real response */
    }
    return res;
  };
  (patched as any).__eoPatched = true;
  window.fetch = patched;

  return () => { window.fetch = original; };
}
