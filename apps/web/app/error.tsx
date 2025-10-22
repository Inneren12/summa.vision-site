"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <section className="p-8">
      <h2 className="text-xl font-bold">Error</h2>
      <pre className="mt-2 text-sm">{error.message}</pre>
      <button className="mt-4 border px-3 py-1" type="button" onClick={() => reset()}>
        Retry
      </button>
    </section>
  );
}
