import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type CookieValue = { name: string; value: string };

const cookiesMock = vi.hoisted(() =>
  vi.fn<() => { get: (name: string) => CookieValue | undefined; getAll: () => CookieValue[] }>(),
);

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

import { getFlagsServer } from "../../lib/ff/effective.server";
import { __clearTelemetry, readRecent } from "../../lib/ff/telemetry";

describe("telemetry integration via getFlagsServer()", () => {
  const savedEnv = { ...process.env };

  const mockCookies = (entries: Array<{ name: string; value: string }>) => {
    const get = vi.fn((name: string) => entries.find((e) => e.name === name));
    const getAll = vi.fn(() => entries);
    cookiesMock.mockReturnValue({ get, getAll });
  };

  beforeEach(() => {
    cookiesMock.mockReset();
    Object.assign(process.env, savedEnv);
    process.env.NODE_ENV = "test";
    process.env.FF_TELEMETRY_SINK = "memory";
    process.env.FEATURE_FLAGS_JSON = JSON.stringify({
      betaUI: true,
      newCheckout: { enabled: true, percent: 100 },
    });
    __clearTelemetry();
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      delete (process.env as NodeJS.ProcessEnv)[key];
    }
    Object.assign(process.env, savedEnv);
    __clearTelemetry();
  });

  it("records events with source=env when no overrides", async () => {
    mockCookies([{ name: "sv_id", value: "sv_abc" }]);
    await getFlagsServer();
    const events = readRecent(50);
    const flags = events.map((e) => e.flag);
    expect(flags).toContain("betaUI");
    expect(flags).toContain("newCheckout");
    expect(events.every((e) => e.source === "env" || e.source === "default")).toBe(true);
  });

  it("records source=override when cookie override present", async () => {
    mockCookies([
      { name: "sv_id", value: "sv_abc" },
      { name: "sv_flags_override", value: JSON.stringify({ betaUI: false }) },
    ]);
    await getFlagsServer();
    const events = readRecent(50, { flag: "betaUI" });
    expect(events.length).toBeGreaterThan(0);
    const last = events[events.length - 1];
    expect(last.source).toBe("override");
    expect(String(last.value)).toBe("false");
  });
});
