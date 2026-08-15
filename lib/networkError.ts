/**
 * Turn a thrown fetch/parse failure into something the person can act on.
 *
 * `fetch` rejects with a bare TypeError when the request never reached a
 * server — no network, the host is down, a tunnel is closed. Browsers word it
 * unhelpfully and differently ("Load failed" in Safari, "Failed to fetch" in
 * Chrome), and reporting all of that as "An error occurred" tells the user
 * nothing about whether to retry, check their wifi, or call someone.
 *
 * This matters more than usual here: the app is self-hosted and reached over a
 * tunnel (see DEPLOYMENT.md), so "the server isn't reachable right now" is a
 * genuinely common failure and is not the user's fault.
 */
export function describeNetworkError(err: unknown): string {
  if (err instanceof TypeError) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  if (err instanceof SyntaxError) {
    // res.json() choked — a proxy or error page returned HTML, not JSON.
    return 'The server returned an unexpected response. Please try again in a moment.';
  }
  return 'Something went wrong. Please try again.';
}
