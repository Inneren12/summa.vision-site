import { promises as fs } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GET as dataHealth } from "@/app/ops/data-health/route";

const REPORT_PATH = path.join(process.cwd(), "reports", "data-validation.json");

describe("ops data health route", () => {
  let savedEnv: Record<string, string | undefined> = {};
  let originalReport: string | null = null;

  beforeEach(async () => {
    savedEnv = { ...process.env } as Record<string, string | undefined>;
    for (const key of Object.keys(process.env)) {
      delete (process.env as Record<string, string | undefined>)[key];
    }
    Object.assign(process.env, savedEnv);
    process.env.NODE_ENV = "test";
    process.env.FF_CONSOLE_VIEWER_TOKENS = "viewer-token";

    try {
      originalReport = await fs.readFile(REPORT_PATH, "utf8");
    } catch {
      originalReport = null;
    }
    await fs.rm(REPORT_PATH, { force: true });
  });

  afterEach(async () => {
    await fs.rm(REPORT_PATH, { force: true });
    if (originalReport !== null) {
      await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
      await fs.writeFile(REPORT_PATH, originalReport, "utf8");
    }
    for (const key of Object.keys(process.env)) {
      delete (process.env as Record<string, string | undefined>)[key];
    }
    Object.assign(process.env, savedEnv);
  });

  it("returns a placeholder when report is missing", async () => {
    const req = new Request("http://localhost/ops/data-health", {
      headers: { authorization: "Bearer viewer-token" },
    });
    const res = await dataHealth(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.msg).toBe("no report");
  });

  it("returns latest report content when available", async () => {
    const sample = {
      ok: true,
      freshness: { source: "warehouse", status: "fresh" },
      ge: { passed: 10, failed: 0 },
      frictionless: { datasets: 2 },
      duckdb: { checks: "ok" },
      license: { status: "valid" },
      ts: Date.now(),
    };
    await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
    await fs.writeFile(REPORT_PATH, JSON.stringify(sample), "utf8");

    const req = new Request("http://localhost/ops/data-health", {
      headers: { authorization: "Bearer viewer-token" },
    });
    const res = await dataHealth(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.freshness).toMatchObject(sample.freshness);
    expect(body.ge).toMatchObject(sample.ge);
    expect(body.ts).toBe(sample.ts);
  });
});
