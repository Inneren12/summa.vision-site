import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const logAdminAction = vi.fn();

vi.mock("@/lib/ff/audit", () => ({
  logAdminAction,
}));

describe("GET /api/privacy/export", () => {
  const originalEnv = { ...process.env };
  let tempDir: string;

  beforeEach(async () => {
    vi.resetModules();
    logAdminAction.mockReset();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "privacy-export-"));
    process.env.METRICS_VITALS_FILE = path.join(tempDir, "vitals.ndjson");
    process.env.METRICS_ERRORS_FILE = path.join(tempDir, "errors.ndjson");
    process.env.TELEMETRY_FILE = path.join(tempDir, "telemetry.ndjson");
  });

  afterEach(async () => {
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
    if (originalEnv.PRIVACY_EXPORT_MAX_RECORDS) {
      process.env.PRIVACY_EXPORT_MAX_RECORDS = originalEnv.PRIVACY_EXPORT_MAX_RECORDS;
    } else {
      delete process.env.PRIVACY_EXPORT_MAX_RECORDS;
    }
    if (originalEnv.PRIVACY_EXPORT_MAX_BYTES) {
      process.env.PRIVACY_EXPORT_MAX_BYTES = originalEnv.PRIVACY_EXPORT_MAX_BYTES;
    } else {
      delete process.env.PRIVACY_EXPORT_MAX_BYTES;
    }
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  });

  it("returns a zip with matching events for admins", async () => {
    const now = Date.now();
    const keepEvent = {
      snapshotId: "flag/ns",
      metric: "CLS",
      value: 0.5,
      ts: now,
      sid: "sid-admin",
    };
    const skipEvent = {
      snapshotId: "flag/ns",
      metric: "CLS",
      value: 0.9,
      ts: now,
      sid: "sid-other",
    };
    await fs.writeFile(
      process.env.METRICS_VITALS_FILE!,
      `${JSON.stringify(keepEvent)}\n${JSON.stringify(skipEvent)}\n`,
      "utf8",
    );
    await fs.writeFile(
      process.env.METRICS_ERRORS_FILE!,
      `${JSON.stringify({ snapshotId: "flag/ns", ts: now, sid: "sid-admin" })}\n`,
      "utf8",
    );
    await fs.writeFile(
      process.env.TELEMETRY_FILE!,
      `${JSON.stringify({ ts: now, type: "evaluation", sid: "sid-admin" })}\n`,
      "utf8",
    );

    const { GET } = await import("@/app/api/privacy/export/route");
    const request = new Request("http://localhost/api/privacy/export?sid=sid-admin", {
      headers: {
        "x-ff-console-role": "admin",
        "x-request-id": "req-export",
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("cache-control")).toBe("no-store");

    const buffer = Buffer.from(await response.arrayBuffer());
    const zip = await JSZip.loadAsync(buffer);
    const vitalsContent = (await zip.file("vitals.ndjson")?.async("string")) ?? "";
    const vitalsLines = vitalsContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(vitalsLines).toHaveLength(1);
    expect(vitalsLines[0]).toMatchObject({ sid: "sid-admin" });

    const errorsContent = (await zip.file("errors.ndjson")?.async("string")) ?? "";
    expect(errorsContent.trim()).not.toBe("");

    const telemetryContent = (await zip.file("telemetry.ndjson")?.async("string")) ?? "";
    expect(telemetryContent.trim()).not.toBe("");

    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "privacy_export",
        actor: "admin",
        recordCount: 3,
        identifiers: expect.objectContaining({
          sid: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
    );
  });

  it("returns empty files for self-service when no events match", async () => {
    await fs.writeFile(process.env.METRICS_VITALS_FILE!, "", "utf8");
    await fs.writeFile(process.env.METRICS_ERRORS_FILE!, "", "utf8");
    await fs.writeFile(process.env.TELEMETRY_FILE!, "", "utf8");

    const { GET } = await import("@/app/api/privacy/export/route");
    const request = new Request("http://localhost/api/privacy/export", {
      headers: {
        cookie: "sv_id=sid-self",
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(200);

    const buffer = Buffer.from(await response.arrayBuffer());
    const zip = await JSZip.loadAsync(buffer);
    for (const name of ["vitals.ndjson", "errors.ndjson", "telemetry.ndjson"]) {
      const content = (await zip.file(name)?.async("string")) ?? "";
      expect(content.trim()).toBe("");
    }

    expect(logAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "privacy_export",
        actor: "self",
        recordCount: 0,
      }),
    );
  });

  it("respects configurable export limits", async () => {
    process.env.PRIVACY_EXPORT_MAX_RECORDS = "1";
    await fs.writeFile(
      process.env.METRICS_VITALS_FILE!,
      `${JSON.stringify({ sid: "sid-limit", ts: Date.now() })}\n${JSON.stringify({ sid: "sid-limit", ts: Date.now() })}\n`,
      "utf8",
    );
    await fs.writeFile(process.env.METRICS_ERRORS_FILE!, "", "utf8");
    await fs.writeFile(process.env.TELEMETRY_FILE!, "", "utf8");

    const { GET } = await import("@/app/api/privacy/export/route");
    const request = new Request("http://localhost/api/privacy/export?sid=sid-limit", {
      headers: {
        "x-ff-console-role": "admin",
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: "Too many records" });
    expect(logAdminAction).not.toHaveBeenCalled();
  });
});
