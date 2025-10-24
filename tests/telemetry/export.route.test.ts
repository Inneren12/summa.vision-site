import fs from "node:fs/promises";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";


import { GET } from "@/app/api/telemetry/export/route";

const TEST_URL = "https://example.com/api/telemetry/export";

describe("/api/telemetry/export", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    Object.assign(process.env, savedEnv);
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

    const res = await GET(new Request(TEST_URL));
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
    const res = await GET(new Request(`${TEST_URL}?from=2024-07-10&to=2024-07-01`));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
