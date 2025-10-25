import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const TEMP_DIR = path.join(process.cwd(), "app", "__doctor_json__");
const TEMP_FILE = path.join(TEMP_DIR, "index.tsx");
const TELEMETRY_DIR = path.join(process.cwd(), "reports", "__doctor_json__");
const TELEMETRY_FILE = path.join(TELEMETRY_DIR, "telemetry.ndjson");

type DoctorUnused = {
  name: string;
  confidence: "high" | "medium" | "low";
  references: number;
  exposures: number;
  telemetryAvailable: boolean;
};

type DoctorStale = {
  name: string;
  confidence: "high" | "medium" | "low";
  references: number;
  exposures: number;
  threshold: number;
};

type DoctorPayload = {
  files: number;
  refs: Record<string, number>;
  fuzzyRefs: Record<string, number>;
  exposures: Record<string, number>;
  unused: DoctorUnused[];
  stale: DoctorStale[];
  fuzzyOnly?: Array<{ name: string }>;
  unknown: Array<{ name: string; file: string; line: number; col: number }>;
  telemetry?: { available: boolean };
};

function ensureTempFile(content: string) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  fs.writeFileSync(TEMP_FILE, content, "utf8");
}

function ensureTelemetry(lines: string[]) {
  fs.mkdirSync(TELEMETRY_DIR, { recursive: true });
  fs.writeFileSync(TELEMETRY_FILE, `${lines.join("\n")}`, "utf8");
}

afterEach(() => {
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
  if (fs.existsSync(TELEMETRY_DIR)) {
    fs.rmSync(TELEMETRY_DIR, { recursive: true, force: true });
  }
});

describe("ff-doctor --json output", () => {
  it("produces parseable JSON with refs/unknown/unused fields", () => {
    ensureTempFile(`
      const a = useFlag('betaUI');
      const b = useFlag('newCheckout');
      const link = "/api/ff-override?ff=unknownFlag:true";
      const grey = "?ff=bannerText:true";
    `);
    const now = Date.now();
    ensureTelemetry([
      JSON.stringify({ ts: now, type: "exposure", flag: "betaUI" }),
      JSON.stringify({ ts: now - 500, type: "exposure", flag: "betaUI" }),
      JSON.stringify({ ts: now - 250, type: "exposure", flag: "newCheckout" }),
    ]);
    let output = "";
    try {
      output = execFileSync(
        process.execPath,
        [
          "scripts/ff-doctor.mjs",
          "--json",
          "--telemetry",
          TELEMETRY_FILE,
          "--min-exposures=2",
          "--days=365",
        ],
        {
          encoding: "utf8",
        },
      );
    } catch (error) {
      const err = error as { stdout?: string };
      output = err.stdout ?? "";
    }
    const payload = JSON.parse(output) as DoctorPayload;
    expect(payload).toHaveProperty("files");
    expect(payload).toHaveProperty("refs");
    expect(Array.isArray(payload.unknown)).toBe(true);
    const names = new Set(payload.unknown.map((entry) => entry.name));
    expect(names.has("unknownFlag")).toBe(true);
    expect(Array.isArray(payload.unused)).toBe(true);
    const unusedNames = new Set(payload.unused.map((entry) => entry.name));
    expect(unusedNames.has("bannerText")).toBe(true);
    const bannerEntry = payload.unused.find((entry) => entry.name === "bannerText");
    expect(bannerEntry?.confidence).toBeDefined();
    expect(Array.isArray(payload.stale)).toBe(true);
    const staleNames = new Set(payload.stale.map((entry) => entry.name));
    expect(staleNames.has("newCheckout")).toBe(true);
    expect(staleNames.has("betaUI")).toBe(false);
    const staleEntry = payload.stale.find((entry) => entry.name === "newCheckout");
    expect(staleEntry?.confidence).toMatch(/^(medium|low)$/);
    const fuzzy = new Set((payload.fuzzyOnly ?? []).map((entry) => entry.name));
    expect(fuzzy.has("bannerText")).toBe(true);
    expect(payload.telemetry?.available).toBe(true);
  });
});

describe("ff-doctor --watch output", () => {
  it("emits NDJSON events with reports", async () => {
    const child = spawn(process.execPath, ["scripts/ff-doctor.mjs", "--watch", "--days=0"], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });

    const received = [] as Array<Record<string, unknown>>;

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("timeout waiting for watch report"));
      }, 15000);

      const lines: string[] = [];
      const handleChunk = (chunk: Buffer) => {
        lines.push(...chunk.toString("utf8").split(/\r?\n/));
        while (lines.length) {
          const line = lines.shift();
          if (!line) continue;
          try {
            const parsed = JSON.parse(line) as Record<string, unknown>;
            received.push(parsed);
            if (parsed.type === "report") {
              cleanup();
              resolve();
              return;
            }
          } catch {
            // ignore malformed lines
          }
        }
      };

      const cleanup = () => {
        clearTimeout(timer);
        child.stdout.off("data", handleChunk);
        child.stderr.off("data", handleChunk);
      };

      child.stdout.on("data", handleChunk);
      child.stderr.on("data", handleChunk);
    });

    child.kill("SIGINT");
    await once(child, "exit");

    expect(received.some((event) => event.type === "watch-start")).toBe(true);
    const reportEvent = received.find((event) => event.type === "report");
    expect(reportEvent).toBeDefined();
    expect(reportEvent?.payload).toBeTypeOf("object");
    expect(reportEvent?.payload && typeof reportEvent.payload === "object").toBe(true);
  });
});
