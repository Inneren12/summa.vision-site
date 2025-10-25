import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __clearErasureCacheForTests } from "@/lib/privacy/erasure";

const deleteOverridesByUser = vi.fn();
const logAdminAction = vi.fn();

vi.mock("@/lib/ff/runtime", () => ({
  FF: () => ({
    store: {
      deleteOverridesByUser,
    },
  }),
}));

vi.mock("@/lib/ff/audit", () => ({
  logAdminAction,
}));

describe("POST /api/privacy/erase", () => {
  const originalEnv = { ...process.env };
  let tempDir: string;
  let erasureFile: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "privacy-erase-"));
    erasureFile = path.join(tempDir, "privacy.erasure.ndjson");
    process.env.PRIVACY_ERASURE_FILE = erasureFile;
    process.env.METRICS_VITALS_FILE = path.join(tempDir, "vitals.ndjson");
    process.env.METRICS_ERRORS_FILE = path.join(tempDir, "errors.ndjson");
    process.env.TELEMETRY_FILE = path.join(tempDir, "telemetry.ndjson");
    deleteOverridesByUser.mockReset();
    logAdminAction.mockReset();
    __clearErasureCacheForTests();
  });

  afterEach(async () => {
    __clearErasureCacheForTests();
    if (originalEnv.PRIVACY_ERASURE_FILE) {
      process.env.PRIVACY_ERASURE_FILE = originalEnv.PRIVACY_ERASURE_FILE;
    } else {
      delete process.env.PRIVACY_ERASURE_FILE;
    }
    if (originalEnv.METRICS_VITALS_FILE) {
      process.env.METRICS_VITALS_FILE = originalEnv.METRICS_VITALS_FILE;
    } else {
      delete process.env.METRICS_VITALS_FILE;
    }
    if (originalEnv.METRICS_ERRORS_FILE) {
      process.env.METRICS_ERRORS_FILE = originalEnv.METRICS_ERRORS_FILE;
    } else {
      delete process.env.METRICS_ERRORS_FILE;
    }
    if (originalEnv.TELEMETRY_FILE) {
      process.env.TELEMETRY_FILE = originalEnv.TELEMETRY_FILE;
    } else {
      delete process.env.TELEMETRY_FILE;
    }
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  });

  it("self-service erases identifiers from cookies", async () => {
    const { POST } = await import("@/app/api/privacy/erase/route");
    const request = new Request("http://localhost/api/privacy/erase", {
      method: "POST",
      headers: {
        cookie: "sv_id=sid-self; ff_aid=aid-self",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const clearedCookies = response.cookies
      .getAll()
      .filter((cookie) => ["ff_aid", "sv_aid", "aid"].includes(cookie.name));
    expect(clearedCookies).toHaveLength(3);
    for (const cookie of clearedCookies) {
      expect(cookie.value).toBe("");
      expect(cookie.maxAge).toBe(0);
    }
    const registry = await fs.readFile(erasureFile, "utf8");
    const records = registry
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ sid: "aid-self", aid: "aid-self", source: "self" });
    expect(deleteOverridesByUser).not.toHaveBeenCalled();
  });

  it("admin purge removes metrics and logs audit", async () => {
    const now = Date.now();
    const vitalsLine = {
      snapshotId: "flag/ns",
      metric: "CLS",
      value: 0.5,
      ts: now,
      sid: "sid-admin",
    };
    const errorsLine = { snapshotId: "flag/ns", ts: now, sid: "sid-admin" };
    const telemetryLine = { stableId: "sid-admin", ts: now, type: "evaluation" };
    await fs.writeFile(process.env.METRICS_VITALS_FILE!, `${JSON.stringify(vitalsLine)}\n`, "utf8");
    await fs.writeFile(process.env.METRICS_ERRORS_FILE!, `${JSON.stringify(errorsLine)}\n`, "utf8");
    await fs.writeFile(process.env.TELEMETRY_FILE!, `${JSON.stringify(telemetryLine)}\n`, "utf8");
    deleteOverridesByUser.mockResolvedValue(2);

    const { POST } = await import("@/app/api/privacy/erase/route");
    const request = new Request("http://localhost/api/privacy/erase", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ff-console-role": "admin",
        "x-request-id": "req-admin",
        cookie: "sv_id=sid-admin",
      },
      body: JSON.stringify({ userId: "user_123", sid: "sid-admin" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    const clearedCookies = response.cookies
      .getAll()
      .filter((cookie) => ["ff_aid", "sv_aid", "aid"].includes(cookie.name));
    expect(clearedCookies).toHaveLength(3);
    for (const cookie of clearedCookies) {
      expect(cookie.value).toBe("");
      expect(cookie.maxAge).toBe(0);
    }
    expect(payload.removedOverrides).toBe(2);
    expect(Array.isArray(payload.purge)).toBe(true);
    expect(payload.purge).toHaveLength(3);
    expect(deleteOverridesByUser).toHaveBeenCalledWith("user_123");
    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "privacy_erase",
        actor: "admin",
        removedOverrides: 2,
        identifiers: expect.objectContaining({ userId: "user_123", sid: "sid-admin" }),
      }),
    );

    const metricsContent = await fs.readFile(process.env.METRICS_VITALS_FILE!, "utf8");
    expect(metricsContent.trim()).toBe("");
    const errorsContent = await fs.readFile(process.env.METRICS_ERRORS_FILE!, "utf8");
    expect(errorsContent.trim()).toBe("");
    const telemetryContent = await fs.readFile(process.env.TELEMETRY_FILE!, "utf8");
    expect(telemetryContent.trim()).toBe("");
  });

  it("reports erasure status for matching sid", async () => {
    const { POST } = await import("@/app/api/privacy/erase/route");
    await POST(
      new Request("http://localhost/api/privacy/erase", {
        method: "POST",
        headers: { cookie: "sv_id=sid-status" },
      }),
    );

    const { GET } = await import("@/app/api/privacy/status/route");
    const response = await GET(
      new Request("http://localhost/api/privacy/status", {
        headers: { cookie: "sv_id=sid-status" },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      erased: true,
      identifiers: { sid: "sid-status" },
    });
  });
});
