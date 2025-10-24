import { describe, it, expect } from "vitest";

import type { FlagConfig } from "../../lib/ff/core/ports";
import { buildSnapshotFromList } from "../../lib/ff/snapshot";

describe("buildSnapshotFromList", () => {
  it("returns stable header string", () => {
    const flags: FlagConfig[] = [
      { key: "feature.A", namespace: "public", default: true, version: 1 },
      {
        key: "feature.B",
        namespace: "public",
        default: false,
        version: 1,
        rollout: { steps: [{ pct: 0 }] },
      },
    ];
    const seeds = { userId: "u", cookie: "c", ipUa: "h", anonId: "c" };
    const ctx = { path: "/", locale: "en" };
    const snapshot = buildSnapshotFromList(flags, seeds, ctx);

    expect(snapshot).toContain("public:feature.A=on");
    expect(snapshot).toContain("public:feature.B=");
  });
});
