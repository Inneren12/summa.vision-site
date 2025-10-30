import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";

const FILE = process.env.SV_FLAGS_EVENTS_FILE ?? "/tmp/sv_flags_events.json";

export type ExposureEvent = {
  type: "exposure";
  gate: string;
  ts: string;
  source?: string;
};

type Store = {
  events: ExposureEvent[];
  last?: { gate: string; ts: number };
};

async function readStore(): Promise<Store> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as Store).events)) {
      return parsed as Store;
    }
    return { events: [] };
  } catch {
    return { events: [] };
  }
}

async function writeStore(store: Store) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(store), "utf8");
}

export async function appendExposure(event: { gate: string; source?: string }) {
  const store = await readStore();
  const now = Date.now();
  if (!store.last || store.last.gate !== event.gate || now - store.last.ts > 1000) {
    store.events.push({
      type: "exposure",
      gate: event.gate,
      ts: new Date(now).toISOString(),
      source: event.source,
    });
    store.last = { gate: event.gate, ts: now };
    await writeStore(store);
  }
}

export async function getEvents() {
  const store = await readStore();
  return store.events;
}
