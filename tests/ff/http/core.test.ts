import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { handleExposure, handleFlag, handleFlags, handleOverride } from "@/lib/ff/http/core";
import type { RequestLike } from "@/lib/ff/http/types";
import { composeFFRuntime, resetFFRuntime } from "@/lib/ff/runtime";
import { InMemoryRuntimeLock } from "@/lib/ff/runtime/lock";
import { MemoryFlagStore } from "@/lib/ff/runtime/memory-store";

function createRequest(
  options: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
    body?: unknown;
  } = {},
): RequestLike {
  const headers = new Map<string, string>();
  for (const [key, value] of Object.entries(options.headers ?? {})) {
    headers.set(key.toLowerCase(), value);
  }
  const cookies = new Map<string, string>(Object.entries(options.cookies ?? {}));
  let consumed = false;
  return {
    method: options.method ?? "GET",
    url: options.url ?? "https://example.com/api",
    headers: {
      get(name: string) {
        return headers.get(name.toLowerCase()) ?? null;
      },
    },
    cookies: {
      get(name: string) {
        return cookies.get(name);
      },
    },
    async json() {
      if (consumed) throw new Error("Body already consumed");
      consumed = true;
      return options.body ?? null;
    },
    async text() {
      if (consumed) throw new Error("Body already consumed");
      consumed = true;
      if (typeof options.body === "string") return options.body;
      if (options.body === undefined || options.body === null) return "";
      return JSON.stringify(options.body);
    },
  } satisfies RequestLike;
}

const telemetryEvents: unknown[] = [];

beforeEach(() => {
  telemetryEvents.length = 0;
  composeFFRuntime({
    store: new MemoryFlagStore(),
    lock: new InMemoryRuntimeLock(),
    telemetry: { emit: (event) => telemetryEvents.push(event) },
  });
  process.env.NODE_ENV = "test";
  process.env.ADMIN_RATE_LIMIT_OVERRIDE_RPM = "0";
  delete process.env.FF_ENFORCE_KNOWN_FLAGS;
});

afterEach(() => {
  resetFFRuntime();
});

describe("handleFlags", () => {
  it("lists flags scoped by namespace", async () => {
    const createPayload = {
      key: "betaUI",
      namespace: "default",
      default: true,
      description: "Beta flag",
    };
    const post = await handleFlags(
      createRequest({
        method: "POST",
        body: createPayload,
        headers: { "content-type": "application/json" },
      }),
    );
    expect(post.kind).toBe("json");
    expect(post.status).toBe(200);

    const response = await handleFlags(
      createRequest({ url: "https://example.com/api/flags?ns=default" }),
    );
    expect(response.kind).toBe("json");
    expect(response.status).toBe(200);
    const body = response.body as {
      ok: boolean;
      flags: Array<{ key: string }>;
      namespace?: string;
    };
    expect(body.ok).toBe(true);
    expect(body.namespace).toBe("default");
    expect(body.flags.some((flag) => flag.key === "betaUI")).toBe(true);
  });

  it("rejects invalid flag payload", async () => {
    const response = await handleFlags(createRequest({ method: "POST", body: null }));
    expect(response.kind).toBe("json");
    expect(response.status).toBe(400);
  });
});

describe("handleFlag", () => {
  it("returns flag details when found", async () => {
    await handleFlags(
      createRequest({
        method: "POST",
        body: { key: "banner", namespace: "default", default: false },
      }),
    );
    const response = await handleFlag(createRequest(), "banner");
    expect(response.kind).toBe("json");
    expect(response.status).toBe(200);
    const body = response.body as { flag: { key: string } };
    expect(body.flag.key).toBe("banner");
  });

  it("returns 404 for unknown flag", async () => {
    const response = await handleFlag(createRequest(), "missing");
    expect(response.status).toBe(404);
  });
});

describe("handleOverride", () => {
  it("sets override cookie and redirects", async () => {
    const response = await handleOverride(
      createRequest({
        url: "https://example.com/api/ff-override?ff=betaUI:true",
        headers: { "x-forwarded-for": "1.1.1.1" },
      }),
    );
    expect(response.kind).toBe("redirect");
    expect(response.status).toBe(302);
    expect(response.cookies?.[0].name).toBe("sv_flags_override");
  });

  it("returns error when ff parameter missing", async () => {
    const response = await handleOverride(createRequest());
    expect(response.kind).toBe("json");
    expect(response.status).toBe(400);
  });
});

describe("handleExposure", () => {
  it("logs exposure telemetry", async () => {
    const response = await handleExposure(
      createRequest({
        method: "POST",
        headers: { "content-type": "application/json" },
        cookies: { sv_id: "abc123" },
        body: { flag: "betaUI", source: "global", value: true },
      }),
    );
    expect(response.kind).toBe("json");
    expect(response.status).toBe(200);
    expect(telemetryEvents.length).toBeGreaterThan(0);
    const event = telemetryEvents[0] as Record<string, unknown>;
    expect(event.flag).toBe("betaUI");
  });

  it("returns 415 for invalid content type", async () => {
    const response = await handleExposure(
      createRequest({ method: "POST", headers: { "content-type": "text/plain" } }),
    );
    expect(response.status).toBe(415);
  });
});
