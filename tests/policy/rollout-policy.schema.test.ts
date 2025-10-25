import { describe, expect, it } from "vitest";

import {
  RolloutPolicySchema,
  RolloutPolicyValidationError,
  formatRolloutPolicyIssues,
  parseRolloutPolicy,
} from "@/lib/ff/policy/schema.mjs";

const basePolicy = {
  flag: "protectedRollout",
  steps: [0, 10, 50, 100],
};

describe("RolloutPolicySchema", () => {
  it("accepts a minimal valid policy", () => {
    const result = RolloutPolicySchema.safeParse(basePolicy);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.steps).toEqual([0, 10, 50, 100]);
    expect(result.data.host).toBe("http://localhost:3000");
  });

  it("rejects duplicate rollout steps", () => {
    const result = RolloutPolicySchema.safeParse({
      ...basePolicy,
      steps: [0, 10, 10, 20],
    });
    expect(result.success).toBe(false);
    if (!result.success) return;
    const message = formatRolloutPolicyIssues(result.error.issues);
    expect(message).toContain("duplicate step");
  });

  it("rejects decreasing rollout steps", () => {
    const result = RolloutPolicySchema.safeParse({
      ...basePolicy,
      steps: [0, 20, 15],
    });
    expect(result.success).toBe(false);
    if (!result.success) return;
    const message = formatRolloutPolicyIssues(result.error.issues);
    expect(message).toContain("must be greater than previous value");
  });

  it("rejects invalid CLS threshold", () => {
    const result = RolloutPolicySchema.safeParse({
      ...basePolicy,
      stop: { maxCLS: 1.5 },
    });
    expect(result.success).toBe(false);
    if (!result.success) return;
    const message = formatRolloutPolicyIssues(result.error.issues);
    expect(message).toContain("maxCLS must be within [0..1]");
  });

  it("rejects invalid INP threshold", () => {
    const result = RolloutPolicySchema.safeParse({
      ...basePolicy,
      stop: { maxINP: -1 },
    });
    expect(result.success).toBe(false);
    if (!result.success) return;
    const message = formatRolloutPolicyIssues(result.error.issues);
    expect(message).toContain("maxINP must be within [0..10000]");
  });

  it("normalizes hysteresis aliases", () => {
    const parsed = parseRolloutPolicy({
      ...basePolicy,
      hysteresis: { cls: 0.2, inp: 200 },
    });
    expect(parsed.hysteresis).toEqual({ CLS: 0.2, INP: 200 });
  });

  it("accepts canary cohort entries with either identifier", () => {
    const parsed = parseRolloutPolicy({
      ...basePolicy,
      canary: {
        ttlHours: 24,
        cohort: [
          { userId: "ops-user" },
          { ff_aid: "aid-123" },
          { userId: "dual", ff_aid: "aid-dual" },
        ],
      },
    });
    expect(parsed.canary).toEqual({
      ttlHours: 24,
      cohort: [{ userId: "ops-user" }, { ffAid: "aid-123" }, { userId: "dual", ffAid: "aid-dual" }],
    });
  });

  it("rejects canary entries without identifiers", () => {
    const result = RolloutPolicySchema.safeParse({
      ...basePolicy,
      canary: {
        ttlHours: 12,
        cohort: [{}],
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const message = formatRolloutPolicyIssues(result.error.issues);
      expect(message).toContain("must include userId and/or ff_aid");
    }
  });

  it("rejects canary TTL outside supported range", () => {
    const result = RolloutPolicySchema.safeParse({
      ...basePolicy,
      canary: {
        ttlHours: 0,
        cohort: [{ userId: "ops-user" }],
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const message = formatRolloutPolicyIssues(result.error.issues);
      expect(message).toContain("canary.ttlHours must be within [1..168] hours");
    }
  });

  it("throws RolloutPolicyValidationError with formatted issues", () => {
    expect(() =>
      parseRolloutPolicy({
        ...basePolicy,
        steps: [0, 30, 10],
      }),
    ).toThrowError(RolloutPolicyValidationError);

    try {
      parseRolloutPolicy({
        ...basePolicy,
        steps: [0, 30, 10],
      });
    } catch (error) {
      if (error instanceof RolloutPolicyValidationError) {
        const message = formatRolloutPolicyIssues(error.issues);
        expect(message).toContain("must be greater than previous value");
        return;
      }
      throw error;
    }
  });
});
