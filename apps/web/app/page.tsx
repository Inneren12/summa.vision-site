import Link from "next/link";

import { Container } from "@/components/Container";

export default function Home() {
  return (
    <main className="min-h-screen bg-bg text-fg p-8">
      <Container>
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold">Summa Vision</h1>
          <p className="text-lg text-muted">
            Baseline is up. See{" "}
            <Link href="/healthz" className="underline">
              /healthz
            </Link>
            .
          </p>
        </div>
      </Container>
    </main>
  );
}
