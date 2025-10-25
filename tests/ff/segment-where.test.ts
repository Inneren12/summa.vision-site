import { describe, expect, it } from "vitest";

import { evaluateFlag } from "@/lib/ff/runtime/evaluate-flag";
import type { EvaluateFlagContext } from "@/lib/ff/runtime/evaluate-flag";
import type { FlagConfig, SegmentWhere } from "@/lib/ff/runtime/types";

function makeConfig(where: SegmentWhere[]): FlagConfig {
  return {
    key: "test-segment",
    enabled: true,
    defaultValue: false,
    createdAt: 0,
    updatedAt: 0,
    segments: [
      {
        id: "seg",
        priority: 10,
        where,
        override: true,
      },
    ],
  } satisfies FlagConfig;
}

function evaluateWhere(where: SegmentWhere[], ctx?: EvaluateFlagContext) {
  const cfg = makeConfig(where);
  return evaluateFlag({ cfg, ctx: { stableId: "aid-1", ...(ctx ?? {}) } });
}

describe("segment where operators", () => {
  it("matches string equality", () => {
    const result = evaluateWhere([{ field: "namespace", op: "eq", value: "summa" }], {
      namespace: "summa",
    });
    expect(result).toMatchObject({ reason: "segmentOverride", value: true });
  });

  it("matches startsWith", () => {
    const result = evaluateWhere([{ field: "user", op: "startsWith", value: "user-" }], {
      userId: "user-123",
    });
    expect(result.reason).toBe("segmentOverride");
  });

  it("matches contains", () => {
    const result = evaluateWhere([{ field: "namespace", op: "contains", value: "tenant" }], {
      namespace: "tenant-acme",
    });
    expect(result.reason).toBe("segmentOverride");
  });

  it("matches in", () => {
    const result = evaluateWhere([{ field: "tag", op: "in", values: ["beta", "alpha"] }], {
      tags: ["beta"],
    });
    expect(result.reason).toBe("segmentOverride");
  });

  it("matches notIn when value is outside the set", () => {
    const result = evaluateWhere([{ field: "namespace", op: "notIn", values: ["prod", "beta"] }], {
      namespace: "summa",
    });
    expect(result.reason).toBe("segmentOverride");

    const negative = evaluateWhere(
      [{ field: "namespace", op: "notIn", values: ["prod", "beta"] }],
      {
        namespace: "prod",
      },
    );
    expect(negative.reason).toBe("default");
  });

  it("matches numeric eq", () => {
    const result = evaluateWhere([{ field: "attributes.planLevel", op: "eq", value: 2 }], {
      attributes: { planLevel: 2 },
    });
    expect(result.reason).toBe("segmentOverride");
  });

  it("matches numeric gt", () => {
    const result = evaluateWhere([{ field: "attributes.visits", op: "gt", value: 5 }], {
      attributes: { visits: 10 },
    });
    expect(result.reason).toBe("segmentOverride");
  });

  it("matches numeric lt", () => {
    const result = evaluateWhere([{ field: "attributes.visits", op: "lt", value: 5 }], {
      attributes: { visits: 2 },
    });
    expect(result.reason).toBe("segmentOverride");
  });

  it("matches between inclusive", () => {
    const result = evaluateWhere([{ field: "attributes.score", op: "between", min: 10, max: 20 }], {
      attributes: { score: 10 },
    });
    expect(result.reason).toBe("segmentOverride");
  });

  it("matches user agent contains", () => {
    const result = evaluateWhere([{ field: "ua", op: "contains", value: "Safari" }], {
      userAgent: "Mobile Safari/605.1.15",
    });
    expect(result.reason).toBe("segmentOverride");
  });

  it("matches path glob", () => {
    const result = evaluateWhere([{ field: "path", op: "glob", value: "/checkout/*" }], {
      path: "/checkout/upsell",
    });
    expect(result.reason).toBe("segmentOverride");
  });

  it("requires all conditions to match", () => {
    const result = evaluateWhere(
      [
        { field: "namespace", op: "eq", value: "summa" },
        { field: "tag", op: "eq", value: "beta" },
      ],
      { namespace: "summa", tags: ["beta", "stable"] },
    );
    expect(result.reason).toBe("segmentOverride");

    const negative = evaluateWhere(
      [
        { field: "namespace", op: "eq", value: "summa" },
        { field: "tag", op: "eq", value: "beta" },
      ],
      { namespace: "summa", tags: ["stable"] },
    );
    expect(negative.reason).toBe("default");
  });

  it("stops at the first matching segment", () => {
    const cfg: FlagConfig = {
      key: "first-match",
      enabled: true,
      defaultValue: false,
      createdAt: 0,
      updatedAt: 0,
      segments: [
        {
          id: "first",
          priority: 10,
          where: [{ field: "namespace", op: "eq", value: "summa" }],
          override: false,
        },
        {
          id: "second",
          priority: 20,
          where: [{ field: "namespace", op: "eq", value: "summa" }],
          override: true,
        },
      ],
    } satisfies FlagConfig;

    const result = evaluateFlag({ cfg, ctx: { stableId: "aid-1", namespace: "summa" } });
    expect(result).toMatchObject({ reason: "segmentOverride", value: false, segmentId: "first" });
  });
});
