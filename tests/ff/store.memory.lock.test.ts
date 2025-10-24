import { describe, it, expect } from "vitest";

import { MemoryStore } from "../../lib/ff/core/store/memory";

describe("MemoryStore withLock", () => {
  it("prevents concurrent section", async () => {
    const store = new MemoryStore();
    let inside = 0;

    const first = store.withLock("k", 1000, async () => {
      inside += 1;
      await new Promise((resolve) => setTimeout(resolve, 50));
      inside -= 1;
      return 1;
    });

    const second = store
      .withLock("k", 1000, async () => {
        inside += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        inside -= 1;
        return 2;
      })
      .then(
        () => "OK",
        (err) => err.message,
      );

    const r1 = await first;
    const r2 = await second;

    expect(r1).toBe(1);
    expect(r2).toBe("locked");
    expect(inside).toBe(0);
  });
});
