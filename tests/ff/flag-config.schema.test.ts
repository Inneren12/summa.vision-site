import { describe, expect, it } from "vitest";

import { FlagConfigListSchema } from "@/lib/ff/schema";

type PartialFlag = Partial<Parameters<typeof FlagConfigListSchema.parse>[0][number]>;

function makeFlag(overrides: PartialFlag = {}) {
  return {
    key: "alpha",
    enabled: true,
    defaultValue: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("FlagConfig schema", () => {
  it("accepts a valid flag configuration", () => {
    const flags = [
      makeFlag({
        rollout: { percent: 50, seedBy: "stableId" },
        segments: [
          {
            id: "namespace:summa",
            priority: 500,
            conditions: [{ field: "namespace", op: "eq", value: "summa" }],
            rollout: { percent: 100, seedBy: "stableId" },
          },
        ],
      }),
    ];

    const result = FlagConfigListSchema.safeParse(flags);
    expect(result.success).toBe(true);
  });

  it("fails when duplicate key appears within the same namespace", () => {
    const flags = [
      makeFlag({ key: "alpha", namespace: "prod" }),
      makeFlag({ key: "alpha", namespace: "prod" }),
    ];

    const result = FlagConfigListSchema.safeParse(flags);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message).join(" ");
      expect(messages).toMatch(/duplicate flag key/i);
    }
  });

  it("rejects rollout percent outside of [0, 100]", () => {
    const flags = [
      makeFlag({
        key: "beta",
        rollout: { percent: 150, seedBy: "stableId" },
      }),
    ];

    const result = FlagConfigListSchema.safeParse(flags);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message).join(" ");
      expect(messages).toMatch(/percent must be within \[0..100]/i);
    }
  });

  it("rejects rollout steps with pct outside of range", () => {
    const flags = [
      makeFlag({
        key: "gamma",
        rollout: {
          percent: 10,
          seedBy: "stableId",
          steps: [
            { pct: 20, note: "initial" },
            { pct: 120, note: "overflow" },
          ],
        },
      }),
    ];

    const result = FlagConfigListSchema.safeParse(flags);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message).join(" ");
      expect(messages).toMatch(/pct must be within \[0..100]/i);
    }
  });

  it("rejects empty segments arrays", () => {
    const flags = [
      makeFlag({
        key: "delta",
        segments: [],
      }),
    ];

    const result = FlagConfigListSchema.safeParse(flags);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message).join(" ");
      expect(messages).toMatch(/segments must contain at least one segment/i);
    }
  });

  it("rejects rollout seedBy outside of allowed set", () => {
    const flags = [
      makeFlag({
        key: "epsilon",
        rollout: { percent: 10, seedBy: "unknown" as never },
      }),
    ];

    const result = FlagConfigListSchema.safeParse(flags);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message).join(" ");
      expect(messages).toMatch(/invalid enum value/i);
    }
  });
});
