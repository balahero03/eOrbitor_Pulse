/**
 * Fetch an authenticated file and hand it to the browser.
 *
 * The file routes live behind `withAuth`, which reads a Bearer token from the
 * `Authorization` header. A browser navigation — a plain `<a href>`, a
 * `window.open`, a form target — cannot send that header, because the token is
 * in localStorage rather than a cookie. So linking straight to one of these
 * routes does not download the file; it navigates to `{"message":"Unauthorized"}`.
 *
 * The only way to reach them from the client is to fetch with the header and
 * then hand the resulting blob to the browser, which is what this does. The
 * lead-attachment download already worked this way; the order page did not,
 * and its Invoice and Receipt links were dead as a result.
 */

/** Everything here needs the token the dashboard stores at sign-in. */
function authHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchBlob(url: string): Promise<{ blob: Blob } | { error: string }> {
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    // These routes answer with JSON on failure ("No invoice uploaded", "Access
    // denied"), which is worth surfacing verbatim — it is more use than a
    // generic failure toast.
    const body = await res.json().catch(() => ({}));
    return { error: (body as any)?.message || `Could not open the file (${res.status})` };
  }
  return { blob: await res.blob() };
}

/**
 * Save the file to disk under `filename`.
 *
 * The object URL is revoked on a timeout rather than immediately: Firefox and
 * Safari cancel an in-flight download if the URL it points at is released in
 * the same tick as the click.
 */
export async function downloadAuthedFile(
  url: string,
  filename: string,
  onError?: (message: string) => void,
): Promise<void> {
  const result = await fetchBlob(url).catch(() => ({ error: 'Download failed. Please try again.' }));
  if ('error' in result) return onError?.(result.error);

  const objectUrl = URL.createObjectURL(result.blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename || 'download';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}

/**
 * Open the file in a new tab, for something meant to be looked at rather than
 * filed away — an invoice PDF, a payment receipt.
 *
 * The tab is opened *before* the await. A popup blocker only trusts
 * `window.open` while it can still see the user's click on the stack, and an
 * awaited fetch loses that; opening first and setting the URL afterwards keeps
 * the gesture. Falls back to a download if the browser blocked it anyway.
 *
 * Safe because of what the server now sends back: `fileResponseHeaders` derives
 * the Content-Type from the file's verified extension and only lets images and
 * PDFs be inline, so a blob opened here cannot be an HTML document running in
 * this origin.
 */
export async function viewAuthedFile(
  url: string,
  filename: string,
  onError?: (message: string) => void,
): Promise<void> {
  const tab = window.open('', '_blank');
  const result = await fetchBlob(url).catch(() => ({ error: 'Could not open the file. Please try again.' }));
  if ('error' in result) {
    tab?.close();
    return onError?.(result.error);
  }

  const objectUrl = URL.createObjectURL(result.blob);
  if (tab) {
    tab.location.href = objectUrl;
  } else {
    await downloadAuthedFile(url, filename, onError);
  }
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
