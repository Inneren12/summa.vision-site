import crypto from "node:crypto";

import { describe, it, beforeEach, afterEach, expect } from "vitest";

import { POST as overridePost } from "@/app/api/flags/[key]/override/route";
import { POST as killPost } from "@/app/api/kill/route";
import { __resetAdminIdempotencyStore } from "@/lib/admin/idempotency";
import { composeFFRuntime, resetFFRuntime } from "@/lib/ff/runtime";
import { InMemoryRuntimeLock } from "@/lib/ff/runtime/lock";
import { createInitialConfig, MemoryFlagStore } from "@/lib/ff/runtime/memory-store";

const OPS_TOKEN = "ops-cookie-token";
const ADMIN_TOKEN = "admin-cookie-token";
const ENV_KEYS = [
  "FF_CONSOLE_VIEWER_TOKENS",
  "FF_CONSOLE_OPS_TOKENS",
  "FF_CONSOLE_ADMIN_TOKENS",
  "ADMIN_RATE_LIMIT_OVERRIDE_RPM",
  "ADMIN_RATE_LIMIT_KILL_RPM",
  "FF_KILL_ALL",
] as const;

type EnvKey = (typeof ENV_KEYS)[number];

function sessionValue(role: string, token: string): string {
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return `${role}:${hash}`;
}

describe("admin API security guards", () => {
  const savedEnv: Record<EnvKey, string | undefined> = Object.create(null);
  let store: MemoryFlagStore;

  beforeEach(async () => {
    resetFFRuntime();
    __resetAdminIdempotencyStore();
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
    }
    process.env.FF_CONSOLE_VIEWER_TOKENS = process.env.FF_CONSOLE_VIEWER_TOKENS || "viewer-token";
    process.env.FF_CONSOLE_OPS_TOKENS = OPS_TOKEN;
    process.env.FF_CONSOLE_ADMIN_TOKENS = ADMIN_TOKEN;
    process.env.ADMIN_RATE_LIMIT_OVERRIDE_RPM = "0";
    process.env.ADMIN_RATE_LIMIT_KILL_RPM = "0";
    delete process.env.FF_KILL_ALL;
    store = new MemoryFlagStore();
    const lock = new InMemoryRuntimeLock();
    composeFFRuntime({ store, lock });
    await store.putFlag({ ...createInitialConfig("betaUI"), namespace: "default" });
  });

  afterEach(() => {
    resetFFRuntime();
    __resetAdminIdempotencyStore();
    for (const key of ENV_KEYS) {
      const value = savedEnv[key];
      if (typeof value === "undefined") {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("rejects cookie session without CSRF header", async () => {
    const csrfCookie = crypto.randomBytes(8).toString("hex");
    const cookieHeader = `sv_admin_session=${sessionValue("ops", OPS_TOKEN)}; ff_csrf=${csrfCookie}`;
    const res = await overridePost(
      new Request("http://localhost/api/flags/betaUI/override", {
        method: "POST",
        headers: {
          cookie: cookieHeader,
          "content-type": "application/json",
        },
        body: JSON.stringify({ value: true }),
      }),
      { params: { key: "betaUI" } },
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("CSRF verification failed");
    expect(body.reason).toBe("missing-header");
  });

  it("rejects cookie session when CSRF token mismatches", async () => {
    const csrfCookie = crypto.randomBytes(8).toString("hex");
    const cookieHeader = `sv_admin_session=${sessionValue("ops", OPS_TOKEN)}; ff_csrf=${csrfCookie}`;
    const res = await overridePost(
      new Request("http://localhost/api/flags/betaUI/override", {
        method: "POST",
        headers: {
          cookie: cookieHeader,
          "content-type": "application/json",
          "x-csrf-token": "different",
        },
        body: JSON.stringify({ value: true }),
      }),
      { params: { key: "betaUI" } },
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.reason).toBe("mismatch");
  });

  it("replays stored response when Idempotency-Key is reused", async () => {
    const key = "dup-key-1";
    const first = await killPost(
      new Request("http://localhost/api/kill", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${ADMIN_TOKEN}`,
          "Idempotency-Key": key,
        },
        body: JSON.stringify({ enable: true }),
      }),
    );
    expect(first.status).toBe(200);
    expect(first.headers.get("x-idempotency-cache")).toBe("stored");
    const firstBody = await first.json();

    const second = await killPost(
      new Request("http://localhost/api/kill", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${ADMIN_TOKEN}`,
          "Idempotency-Key": key,
        },
        body: JSON.stringify({ enable: true }),
      }),
    );
    expect(second.status).toBe(first.status);
    expect(second.headers.get("x-idempotency-cache")).toBe("hit");
    const secondBody = await second.json();
    expect(secondBody).toEqual(firstBody);
  });
});
