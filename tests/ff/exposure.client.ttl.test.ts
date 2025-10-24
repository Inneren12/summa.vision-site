import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { trackExposureClient } from "@/lib/ff/exposure.client";

type StorageStub = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  key?: (index: number) => string | null;
  readonly length?: number;
};

type GlobalWithStorage = typeof globalThis & {
  sessionStorage?: StorageStub;
  localStorage?: StorageStub;
  window?: { sessionStorage: StorageStub; localStorage: StorageStub };
  fetch?: Mock | typeof fetch;
};

function createStorage(): StorageStub {
  const store = new Map<string, string>();
  const storage: StorageStub = {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    key(index: number) {
      const keys = Array.from(store.keys());
      return keys[index] ?? null;
    },
  };
  Object.defineProperty(storage, "length", {
    get() {
      return store.size;
    },
  });
  return storage;
}

const ORIGINAL_FETCH = globalThis.fetch;

describe("trackExposureClient TTL dedup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const globalScope = globalThis as GlobalWithStorage;
    const session = createStorage();
    const local = createStorage();
    globalScope.sessionStorage = session;
    globalScope.localStorage = local;
    globalScope.window = { sessionStorage: session, localStorage: local };
    globalScope.fetch = vi.fn().mockResolvedValue({ ok: true }) as unknown as Mock;
  });

  afterEach(() => {
    vi.useRealTimers();
    const globalScope = globalThis as GlobalWithStorage;
    delete globalScope.window;
    delete globalScope.sessionStorage;
    delete globalScope.localStorage;
    if (ORIGINAL_FETCH) {
      globalScope.fetch = ORIGINAL_FETCH;
    } else {
      delete globalScope.fetch;
    }
    vi.restoreAllMocks();
  });

  it("sends once per tab and per 24h window", async () => {
    await trackExposureClient({ flag: "betaUI", value: true, source: "env" });
    await trackExposureClient({ flag: "betaUI", value: true, source: "env" });
    let fetchMock = (globalThis as GlobalWithStorage).fetch as Mock;
    expect(fetchMock).toHaveBeenCalledTimes(1);

    (globalThis as GlobalWithStorage).sessionStorage?.clear();
    await trackExposureClient({ flag: "betaUI", value: true, source: "env" });
    fetchMock = (globalThis as GlobalWithStorage).fetch as Mock;
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date(Date.now() + 24 * 60 * 60 * 1000 + 1000));
    await trackExposureClient({ flag: "betaUI", value: true, source: "env" });
    fetchMock = (globalThis as GlobalWithStorage).fetch as Mock;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
