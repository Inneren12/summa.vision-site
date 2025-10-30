export const dynamic = "force-dynamic";
export const revalidate = 0;

type ExposureEvent = { type: "exposure"; gate: string; source?: string; ts: string };

type FlagsEventsStore = { events: ExposureEvent[] };

type GlobalWithStore = typeof globalThis & {
  __SV_DEV_FLAGS_STORE__?: FlagsEventsStore;
};

function ensureStore(globalObject: GlobalWithStore): FlagsEventsStore {
  if (!globalObject.__SV_DEV_FLAGS_STORE__) {
    globalObject.__SV_DEV_FLAGS_STORE__ = { events: [] };
  }
  const store = globalObject.__SV_DEV_FLAGS_STORE__;
  if (!Array.isArray(store.events)) {
    store.events = [];
  }
  return store;
}

function logServerSideExposure() {
  const store = ensureStore(globalThis as GlobalWithStore);
  store.events.push({
    type: "exposure",
    gate: "identical-gate",
    source: "ssr",
    ts: new Date().toISOString(),
  });
}

export default async function ExposureTestPage() {
  logServerSideExposure();

  return (
    <main className="p-6 space-y-3">
      <div data-testid="exp-a">exp-a</div>
      <div data-testid="exp-b">exp-b</div>
      <div data-testid="exp-c">exp-c</div>
    </main>
  );
}
