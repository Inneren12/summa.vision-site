import { describe, it, expect } from "vitest";

import { getClientEnv } from "../lib/env.client";

describe("client env validation", () => {
  it("validates client env", () => {
    process.env.NEXT_PUBLIC_APP_ENV = "staging";
    const clientEnv = getClientEnv();
    expect(clientEnv.NEXT_PUBLIC_APP_ENV).toBe("staging");
  });
});
