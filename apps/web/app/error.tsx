"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="min-h-screen bg-bg p-8 text-fg">
      <h2 className="text-2xl font-semibold">Something went wrong</h2>
      <pre className="mt-4 rounded bg-primary/10 p-4 text-sm text-fg/80">{error.message}</pre>
      <button
        type="button"
        className="mt-6 inline-flex items-center justify-center rounded border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium text-fg transition hover:bg-primary/20"
        onClick={() => reset()}
      >
        Try again
      </button>
    </main>
  );
}
