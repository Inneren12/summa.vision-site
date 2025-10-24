import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { trackExposureClient } from "@/lib/ff/exposure.client";

type StorageStub = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  key?: (index: number) => string | null;
  readonly length?: number;
};

type FetchMock = ReturnType<typeof vi.fn>;

type GlobalWithMocks = typeof globalThis & {
  sessionStorage?: StorageStub;
  window?: { sessionStorage: StorageStub };
  fetch?: FetchMock;
};

describe("Exposure client dedup", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
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
    const globalScope = globalThis as GlobalWithMocks;
    globalScope.sessionStorage = storage;
    globalScope.window = { sessionStorage: storage };
    globalScope.fetch = vi.fn().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    const globalScope = globalThis as GlobalWithMocks;
    delete globalScope.window;
    delete globalScope.sessionStorage;
    delete globalScope.fetch;
    vi.restoreAllMocks();
  });

  it("sends once per tab for same flag/value", async () => {
    await trackExposureClient({ flag: "betaUI", value: true, source: "env" });
    await trackExposureClient({ flag: "betaUI", value: true, source: "env" });
    const { fetch } = globalThis as GlobalWithMocks;
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
