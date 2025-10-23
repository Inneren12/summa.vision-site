import { describe, it, expect } from "vitest";

import { GET } from "./route";

describe("healthz cache", () => {
  it("returns no-store Cache-Control", async () => {
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
