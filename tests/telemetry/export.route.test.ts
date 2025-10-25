import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/telemetry/export/route";
import { __clearAudit, logAdminAction } from "@/lib/ff/audit";

const TEST_URL = "https://example.com/api/telemetry/export";

describe("/api/telemetry/export", () => {
  const savedEnv = { ...process.env };
  let tempDir: string;

  async function writeTelemetry(items: Array<Record<string, unknown>>) {
    const file = process.env.TELEMETRY_FILE;
    if (!file) throw new Error("TELEMETRY_FILE not configured");
    const lines = items.map((item) => JSON.stringify(item)).join("\n");
    await fs.writeFile(file, `${lines}\n`, "utf8");
  }

  beforeEach(async () => {
    Object.assign(process.env, savedEnv);
    process.env.FF_CONSOLE_VIEWER_TOKENS = process.env.FF_CONSOLE_VIEWER_TOKENS || "viewer-token";
    process.env.ADMIN_RATE_LIMIT_TELEMETRY_EXPORT_RPM = "0";
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "telemetry-export-"));
    process.env.TELEMETRY_FILE = path.join(tempDir, "telemetry.ndjson");
    __clearAudit();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, savedEnv);
  });

  it("exports NDJSON with hashed PII by default", async () => {
    process.env.TELEMETRY_HASH_SALT = "pepper";
    await writeTelemetry([
      {
        ts: 1719427200000,
        type: "evaluation",
        flag: "betaUI",
        value: true,
        source: "env",
        stableId: "u:alice",
        userId: "alice",
      },
      {
        ts: 1719427205000,
        type: "exposure",
        flag: "checkout",
        value: "control",
        source: "default",
        stableId: "anon-123",
        userKey: "legacy-key",
      },
    ]);

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

  it("exports CSV filtered by date range", async () => {
    await writeTelemetry([
      { ts: 1719427200000, type: "evaluation", flag: "alpha", value: true, source: "env" },
      { ts: 1719428200000, type: "exposure", flag: "beta", value: false, source: "default" },
      {
        ts: 1719429200000,
        type: "evaluation",
        flag: "gamma",
        value: "rollout",
        source: "override",
      },
    ]);

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

  it("filters telemetry by flag", async () => {
    await writeTelemetry([
      { ts: 1719427200000, type: "evaluation", flag: "alpha", value: true, source: "env" },
      { ts: 1719428200000, type: "evaluation", flag: "beta", value: false, source: "env" },
    ]);

    const res = await GET(
      new Request(`${TEST_URL}?flag=beta`, {
        headers: { authorization: "Bearer viewer-token" },
      }),
    );

    expect(res.status).toBe(200);
    const text = await res.text();
    const exported = text
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    expect(exported).toHaveLength(1);
    expect(exported[0].flag).toBe("beta");
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

  it("exports zip bundle with vitals, errors, and audit data", async () => {
    process.env.TELEMETRY_HASH_SALT = "pepper";
    process.env.METRICS_VITALS_FILE = path.join(tempDir, "vitals.ndjson");
    process.env.METRICS_ERRORS_FILE = path.join(tempDir, "errors.ndjson");

    const now = Date.now();
    await writeTelemetry([
      { ts: now - 1_000, type: "evaluation", flag: "betaUI", value: true, source: "env" },
      { ts: now - 500, type: "evaluation", flag: "other", value: false, source: "env" },
    ]);

    await fs.writeFile(
      process.env.METRICS_VITALS_FILE!,
      [
        JSON.stringify({ ts: now - 1_500, metric: "lcp", value: 2500 }),
        JSON.stringify({ ts: now - 750, metric: "cls", value: 0.1 }),
      ].join("\n") + "\n",
      "utf8",
    );

    await fs.writeFile(
      process.env.METRICS_ERRORS_FILE!,
      [
        JSON.stringify({ ts: now - 1_200, message: "boom" }),
        JSON.stringify({ ts: now - 600, message: "noop" }),
      ].join("\n") + "\n",
      "utf8",
    );

    __clearAudit();
    logAdminAction({
      action: "override_set",
      timestamp: now - 800,
      actor: "ops",
      flag: "betaUI",
      scope: { type: "user", id: "beta-session" },
      value: true,
    });
    logAdminAction({
      action: "override_set",
      timestamp: now - 700,
      actor: "ops",
      flag: "other",
      scope: { type: "user", id: "other-session" },
      value: false,
    });

    const from = new Date(now - 2_000).toISOString();
    const to = new Date(now).toISOString();
    const res = await GET(
      new Request(
        `${TEST_URL}?fmt=zip&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&flag=betaUI`,
        { headers: { authorization: "Bearer viewer-token" } },
      ),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/zip");

    const buffer = Buffer.from(await res.arrayBuffer());
    const zip = await JSZip.loadAsync(buffer);

    const telemetryText = await zip.file("telemetry.ndjson")?.async("string");
    expect(telemetryText).toBeTruthy();
    const telemetryLines = telemetryText?.trim().split("\n") ?? [];
    expect(telemetryLines).toHaveLength(1);
    expect(JSON.parse(telemetryLines[0]!).flag).toBe("betaUI");

    const auditText = await zip.file("audit.ndjson")?.async("string");
    expect(auditText).toBeTruthy();
    const auditLines = auditText?.trim().split("\n") ?? [];
    expect(auditLines).toHaveLength(1);
    expect(JSON.parse(auditLines[0]!).flag).toBe("betaUI");

    const vitalsText = (await zip.file("vitals.ndjson")?.async("string")) ?? "";
    expect(vitalsText.trim()).not.toBe("");

    const errorsText = (await zip.file("errors.ndjson")?.async("string")) ?? "";
    expect(errorsText.trim()).not.toBe("");

    const metadata = await zip.file("metadata.json")?.async("string");
    expect(metadata).toBeTruthy();
    const parsedMetadata = metadata ? JSON.parse(metadata) : null;
    expect(parsedMetadata?.datasets?.telemetry?.records).toBe(1);
    expect(parsedMetadata?.filters?.flags).toContain("betaUI");
  });
});
