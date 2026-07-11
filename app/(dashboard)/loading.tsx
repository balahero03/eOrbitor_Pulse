// Neutral segment loader shown during route Suspense.
export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="w-7 h-7 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
