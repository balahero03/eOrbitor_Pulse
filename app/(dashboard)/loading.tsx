import { InlineLoader } from '@/components/BrandedLoader';

// Route-level Suspense fallback. Shares the branded mark with the login/logout
// transition rather than showing a bare blue spinner, so moving between pages
// looks like the same product the whole way through.
export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <InlineLoader message="Loading…" />
    </div>
  );
}
