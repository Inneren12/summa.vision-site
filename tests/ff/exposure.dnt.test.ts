import * as nextHeaders from "next/headers";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { trackExposure } from "@/lib/ff/exposure";
import { FLAG_REGISTRY } from "@/lib/ff/flags";
import { composeFFRuntime } from "@/lib/ff/runtime";
import type { TelemetryEvent } from "@/lib/ff/telemetry";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
  cookies: vi.fn(),
}));

type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };

describe("Exposure DNT & sensitive", () => {
  const EVENTS: TelemetryEvent[] = [];
  const headersMock = vi.mocked(nextHeaders.headers);

  beforeEach(() => {
    composeFFRuntime({ telemetry: { emit: (event: TelemetryEvent) => EVENTS.push(event) } });
    EVENTS.length = 0;
  });

  afterEach(() => {
    headersMock.mockReset();
    vi.clearAllMocks();
  });

  it("skips logging when DNT: 1", () => {
    headersMock.mockReturnValue({
      get: (key: string) => (key === "dnt" ? "1" : null),
    } as ReturnType<typeof nextHeaders.headers>);
    trackExposure({ flag: "betaUI", value: true, source: "env", stableId: "u:1" });
    expect(EVENTS.length).toBe(0);
  });

  it("redacts sensitive flag value", () => {
    headersMock.mockReturnValue({ get: () => null } as ReturnType<typeof nextHeaders.headers>);
    const registry = FLAG_REGISTRY as Mutable<typeof FLAG_REGISTRY>;
    const original = registry.bannerText;
    try {
      registry.bannerText = { ...original, sensitive: true };
      trackExposure({ flag: "bannerText", value: "SECRET", source: "env", stableId: "u:1" });
    } finally {
      registry.bannerText = original;
    }
    expect(EVENTS.length).toBe(1);
    expect(EVENTS[0].value).toBe("[redacted]");
  });
});
