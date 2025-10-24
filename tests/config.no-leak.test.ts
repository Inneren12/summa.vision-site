import { describe, it, expect } from "vitest";

import { assertNoPublicLeak } from "../lib/env.server";

describe("No leakage of non-public configuration", () => {
  it("blocks exposing non-NEXT_PUBLIC_* keys", () => {
    expect(() =>
      assertNoPublicLeak({ DATABASE_URL: "secret", NEXT_PUBLIC_SITE_URL: "x" }),
    ).toThrowError(/non-public env keys/);
  });

  it("allows ONLY NEXT_PUBLIC_* keys", () => {
    expect(() =>
      assertNoPublicLeak({ NEXT_PUBLIC_SITE_URL: "x", NEXT_PUBLIC_APP_ENV: "local" }),
    ).not.toThrow();
  });
});
