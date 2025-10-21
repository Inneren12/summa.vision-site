"use client";

import { useEffect, useState } from "react";

export default function Healthz() {
  const [data, setData] = useState<unknown>(null);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/healthz")
      .then((response) => response.json())
      .then((json) => {
        if (isMounted) {
          setData(json);
        }
      })
      .catch(() => {
        if (isMounted) {
          setData(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-bg text-fg p-6">
      <pre className="rounded-lg bg-primary/10 p-4 text-sm text-fg/80 shadow">
        {JSON.stringify(data, null, 2) || "loading..."}
      </pre>
    </main>
  );
}
