import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";

export const metadata = { title: "Atoms Visual" };

export default function AtomsVisual() {
  return (
    <main className="space-y-6 p-8">
      <div className="space-x-4">
        <Button>Primary</Button>
        <Button disabled>Disabled</Button>
      </div>
      <div className="flex items-center gap-4">
        <Spinner />
        <span>Loading…</span>
      </div>
    </main>
  );
}
