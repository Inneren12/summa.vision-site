import { describe, it, expect } from "vitest";

type HeadersConfig = {
  headers: () => Promise<Array<{ headers?: Array<{ key: string }> }>>;
};

describe("next headers()", () => {
  it("returns route-level headers array", async () => {
    const mod = (await import("./next.config.mjs")) as unknown as HeadersConfig & {
      default?: HeadersConfig;
    };
    const cfg: HeadersConfig = mod.default ?? mod;
    const rules = await cfg.headers();
    const anyHeaders = (rules[0]?.headers ?? []) as Array<{ key: string }>;
    const hasSecurityHeader = anyHeaders.some((header) =>
      [
        "X-Content-Type-Options",
        "Content-Security-Policy",
        "Content-Security-Policy-Report-Only",
        "Cache-Control",
      ].includes(header.key),
    );
    expect(hasSecurityHeader).toBe(true);
  });
});
