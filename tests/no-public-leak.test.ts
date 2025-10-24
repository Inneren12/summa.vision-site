import { describe, it, expect } from "vitest";

import { assertNoPublicLeak } from "../lib/env.server";

describe("no public leak guard", () => {
  it("throws when non-public keys are present", () => {
    expect(() => assertNoPublicLeak({ DATABASE_URL: "x", NEXT_PUBLIC_BASE: "/api" })).toThrowError(
      /Attempted to expose non-public env keys/,
    );
  });

  it("passes for NEXT_PUBLIC_* keys", () => {
    expect(() =>
      assertNoPublicLeak({ NEXT_PUBLIC_BASE: "/api", NEXT_PUBLIC_FLAG: "1" }),
    ).not.toThrow();
  });
});
