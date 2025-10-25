import { describe, expect, it } from "vitest";

import {
  createInitialConfig,
  createOverride,
  MemoryFlagStore,
} from "@/lib/ff/runtime/memory-store";

describe("FlagStore.deleteOverridesByUser", () => {
  it("removes all user overrides across flags", async () => {
    const store = new MemoryFlagStore();
    await store.putFlag(createInitialConfig("alpha"));
    await store.putFlag(createInitialConfig("beta"));

    await store.putOverride(createOverride("alpha", { type: "user", id: "user-42" }, true));
    await store.putOverride(createOverride("beta", { type: "user", id: "user-42" }, false));
    await store.putOverride(createOverride("beta", { type: "user", id: "user-other" }, true));

    const removed = await store.deleteOverridesByUser("user-42");
    expect(removed).toBe(2);

    const alphaOverrides = await store.listOverrides("alpha");
    expect(alphaOverrides).toHaveLength(0);

    const betaOverrides = await store.listOverrides("beta");
    expect(betaOverrides).toHaveLength(1);
    expect(betaOverrides[0].scope).toEqual({ type: "user", id: "user-other" });
  });
});
