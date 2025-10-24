import { describe, it, expect } from "vitest";

import { parseXForwardedFor } from "../../lib/ff/net";

describe("parseXForwardedFor", () => {
  it("returns first ip from list", () => {
    expect(parseXForwardedFor("1.2.3.4, 5.6.7.8")).toBe("1.2.3.4");
  });
  it("handles empty or missing header", () => {
    expect(parseXForwardedFor(undefined)).toBe("unknown");
    expect(parseXForwardedFor("")).toBe("unknown");
  });
});
