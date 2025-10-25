import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/telemetry/export/route";
import { logAdminAction, __clearAudit } from "@/lib/ff/audit";

const TEST_URL = "https://example.com/api/telemetry/export";

describe("/api/telemetry/export", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    Object.assign(process.env, savedEnv);
    process.env.FF_CONSOLE_VIEWER_TOKENS = process.env.FF_CONSOLE_VIEWER_TOKENS || "viewer-token";
    process.env.ADMIN_RATE_LIMIT_TELEMETRY_EXPORT_RPM = "0";
    __clearAudit();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    __clearAudit();
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, savedEnv);
  });

  it("exports NDJSON with hashed PII by default", async () => {
    process.env.TELEMETRY_HASH_SALT = "pepper";
    const lines = [
      JSON.stringify({
        ts: 1719427200000,
        type: "evaluation",
        flag: "betaUI",
        value: true,
        source: "env",
        stableId: "u:alice",
        userId: "alice",
      }),
      JSON.stringify({
        ts: 1719427205000,
        type: "exposure",
        flag: "checkout",
        value: "control",
        source: "default",
        stableId: "anon-123",
        userKey: "legacy-key",
      }),
    ];
    vi.spyOn(fs, "readFile").mockResolvedValue(lines.join("\n"));

    const res = await GET(
      new Request(TEST_URL, {
        headers: { authorization: "Bearer viewer-token" },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    const body = await res.text();
    const exported = body
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    expect(exported).toHaveLength(2);
    expect(exported[0].event).toBe("flag_evaluated");
    expect(exported[0].stableIdHash).toMatch(/^[a-f0-9]{64}$/);
    expect(exported[0].userHash).toMatch(/^[a-f0-9]{64}$/);
    expect(exported[0]).not.toHaveProperty("stableId");
    expect(exported[0]).not.toHaveProperty("userId");
    expect(exported[1].event).toBe("exposure");
    expect(exported[1].userKeyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(exported[1]).not.toHaveProperty("userKey");
  });

  it("filters telemetry rows by flag parameter", async () => {
    const lines = [
      JSON.stringify({ ts: 1, type: "evaluation", flag: "alpha", value: true }),
      JSON.stringify({ ts: 2, type: "evaluation", flag: "beta", value: false }),
    ];
    vi.spyOn(fs, "readFile").mockResolvedValue(lines.join("\n"));

    const res = await GET(
      new Request(`${TEST_URL}?flag=beta`, {
        headers: { authorization: "Bearer viewer-token" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    const rows = body
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    expect(rows).toHaveLength(1);
    expect(rows[0].flag).toBe("beta");
  });

  it("exports CSV filtered by date range", async () => {
    const items = [
      { ts: 1719427200000, type: "evaluation", flag: "alpha", value: true, source: "env" },
      { ts: 1719428200000, type: "exposure", flag: "beta", value: false, source: "default" },
      {
        ts: 1719429200000,
        type: "evaluation",
        flag: "gamma",
        value: "rollout",
        source: "override",
      },
    ];
    vi.spyOn(fs, "readFile").mockResolvedValue(
      items.map((item) => JSON.stringify(item)).join("\n"),
    );

    const from = "2024-06-26T18:50:00.000Z";
    const to = "2024-06-26T19:20:00.000Z";
    const res = await GET(
      new Request(
        `${TEST_URL}?fmt=csv&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { headers: { authorization: "Bearer viewer-token" } },
      ),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const text = await res.text();
    const rows = text.trim().split("\n");
    expect(rows[0]).toContain("ts");
    expect(rows).toHaveLength(3); // header + 2 rows within range
    expect(rows[1]).toContain("beta");
    expect(rows[2]).toContain("gamma");
  });

  it("rejects invalid range", async () => {
    const res = await GET(
      new Request(`${TEST_URL}?from=2024-07-10&to=2024-07-01`, {
        headers: { authorization: "Bearer viewer-token" },
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("exports a zip archive with telemetry, metrics, and audit filters applied", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "telemetry-export-"));
    try {
      const telemetryFile = path.join(tmpDir, "telemetry.ndjson");
      const vitalsFile = path.join(tmpDir, "vitals.ndjson");
      const errorsFile = path.join(tmpDir, "errors.ndjson");
      process.env.TELEMETRY_FILE = telemetryFile;
      process.env.METRICS_VITALS_FILE = vitalsFile;
      process.env.METRICS_ERRORS_FILE = errorsFile;

      const baseTs = Date.UTC(2024, 0, 1, 12, 0, 0);
      await fs.writeFile(
        telemetryFile,
        [
          JSON.stringify({ ts: baseTs, type: "evaluation", flag: "alpha", value: true }),
          JSON.stringify({ ts: baseTs + 1_000, type: "evaluation", flag: "beta", value: false }),
        ].join("\n"),
        "utf8",
      );
      await fs.writeFile(
        vitalsFile,
        [
          JSON.stringify({ ts: baseTs + 500, snapshotId: "snap", metric: "LCP", value: 2500 }),
          JSON.stringify({ ts: baseTs + 60_000, snapshotId: "snap", metric: "CLS", value: 0.12 }),
        ].join("\n"),
        "utf8",
      );
      await fs.writeFile(
        errorsFile,
        [
          JSON.stringify({ ts: baseTs + 750, snapshotId: "snap", message: "boom" }),
          JSON.stringify({ ts: baseTs - 60_000, snapshotId: "snap", message: "ignore" }),
        ].join("\n"),
        "utf8",
      );

      logAdminAction({
        timestamp: baseTs + 1_200,
        actor: "ops",
        action: "override_set",
        flag: "beta",
        scope: { type: "global" },
        value: true,
      });
      logAdminAction({
        timestamp: baseTs - 10_000,
        actor: "ops",
        action: "override_set",
        flag: "alpha",
        scope: { type: "global" },
        value: false,
      });

      const url = `${TEST_URL}?fmt=zip&from=${baseTs}&to=${baseTs + 5_000}&flag=beta`;
      const res = await GET(
        new Request(url, {
          headers: { authorization: "Bearer viewer-token" },
        }),
      );

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/zip");
      const buffer = Buffer.from(await res.arrayBuffer());
      const zip = await JSZip.loadAsync(buffer);

      const telemetryContent = await zip.file("telemetry.ndjson")?.async("string");
      expect(telemetryContent?.trim().split("\n")).toHaveLength(1);
      expect(telemetryContent).toContain('"flag":"beta"');

      const vitalsContent = await zip.file("vitals.ndjson")?.async("string");
      expect(vitalsContent?.trim().split("\n")).toHaveLength(1);
      const errorsContent = await zip.file("errors.ndjson")?.async("string");
      expect(errorsContent?.trim().split("\n")).toHaveLength(1);

      const auditContent = await zip.file("audit.ndjson")?.async("string");
      expect(auditContent?.trim().split("\n")).toHaveLength(1);
      expect(auditContent).toContain('"flag":"beta"');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
