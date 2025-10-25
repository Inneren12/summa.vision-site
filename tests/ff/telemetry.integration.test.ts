import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type CookieValue = { name: string; value: string };

const cookiesMock = vi.hoisted(() =>
  vi.fn<() => { get: (name: string) => CookieValue | undefined; getAll: () => CookieValue[] }>(),
);

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
  headers: vi.fn(() => ({ get: () => null })),
}));

import { __resetServerEnvCacheForTests } from "../../lib/env.server";
import { getFlagsServer, getFlagsServerWithMeta } from "../../lib/ff/effective.server";
import { composeFFRuntime, resetFFRuntime } from "../../lib/ff/runtime";
import { __resetFeatureFlagsCacheForTests } from "../../lib/ff/server";
import { __clearTelemetry, readRecent } from "../../lib/ff/telemetry";
import type { TelemetryEvent } from "../../lib/ff/telemetry";

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
    __resetServerEnvCacheForTests();
    __resetFeatureFlagsCacheForTests();
    __clearTelemetry();
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      delete (process.env as NodeJS.ProcessEnv)[key];
    }
    Object.assign(process.env, savedEnv);
    __clearTelemetry();
    resetFFRuntime();
  });

  it("records events with source=env when no overrides", async () => {
    mockCookies([{ name: "ff_aid", value: "aid_abc" }]);
    await getFlagsServer();
    const events = readRecent(50);
    const flags = events.map((e) => e.flag);
    expect(flags).toContain("betaUI");
    expect(flags).toContain("newCheckout");
    expect(events.every((e) => e.source === "env" || e.source === "default")).toBe(true);
  });

  it("records source=override when cookie override present", async () => {
    mockCookies([
      { name: "ff_aid", value: "aid_abc" },
      { name: "sv_flags_override", value: JSON.stringify({ betaUI: false }) },
    ]);
    await getFlagsServer();
    const events = readRecent(50, { flag: "betaUI" });
    expect(events.length).toBeGreaterThan(0);
    const last = events[events.length - 1];
    expect(last.source).toBe("override");
    expect(String(last.value)).toBe("false");
  });

  it("emits shadow exposures without changing served value", async () => {
    mockCookies([{ name: "ff_aid", value: "aid_shadow" }]);
    process.env.FEATURE_FLAGS_JSON = JSON.stringify({
      newCheckout: { enabled: true, percent: 100, shadow: true },
    });
    __resetServerEnvCacheForTests();
    __resetFeatureFlagsCacheForTests();
    const events: TelemetryEvent[] = [];
    composeFFRuntime({ telemetry: { emit: (event: TelemetryEvent) => events.push(event) } });

    const { flags } = await getFlagsServerWithMeta();

    expect(flags.newCheckout).toBe(false);
    const shadowEvents = events.filter((e) => e.type === "exposure_shadow");
    expect(shadowEvents.length).toBeGreaterThan(0);
    expect(shadowEvents.every((e) => e.flag === "newCheckout")).toBe(true);
    expect(shadowEvents.every((e) => e.value === true)).toBe(true);
  });
});
