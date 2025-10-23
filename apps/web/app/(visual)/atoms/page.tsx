export const metadata = {
  title: "Atoms Showcase",
  description: "Visual snapshots for basic UI atoms",
};

export default function AtomsPage() {
  return (
    <main className="min-h-screen p-6 space-y-8">
      <section className="space-y-4">
        <h1 className="text-xl font-semibold">Buttons</h1>
        <div className="flex gap-4 flex-wrap">
          <button className="rounded border px-3 py-1.5">Default</button>
          <button className="rounded border px-3 py-1.5 opacity-50" disabled>
            Disabled
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <h1 className="text-xl font-semibold">Spinner</h1>
        <div className="flex items-center gap-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
          <span className="text-sm text-neutral-500">Loading…</span>
        </div>
      </section>
    </main>
  );
}
