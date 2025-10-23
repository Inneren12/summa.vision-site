import Link from "next/link";

import { Button } from "../../../components/Button";
import { Spinner } from "../../../components/Spinner";

export const metadata = {
  title: "Atoms Showcase",
  description: "Visual snapshots for basic UI atoms",
};

export default function AtomsPage() {
  return (
    <main className="min-h-screen p-6 space-y-8">
      <nav className="space-x-4">
        <Link href="/">Home</Link>
        <Link href="/healthz">Healthz</Link>
      </nav>

      <section className="space-y-4">
        <h1 className="text-xl font-semibold">Buttons</h1>
        <div className="flex gap-4 flex-wrap">
          <Button>Default</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      <section className="space-y-4">
        <h1 className="text-xl font-semibold">Spinner</h1>
        <div className="flex items-center gap-4">
          <Spinner />
          <span className="text-sm text-neutral-500">Loading…</span>
        </div>
      </section>
    </main>
  );
}
