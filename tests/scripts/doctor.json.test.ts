import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const TEMP_DIR = path.join(process.cwd(), "app", "__doctor_json__");
const TEMP_FILE = path.join(TEMP_DIR, "index.tsx");

type DoctorPayload = {
  files: number;
  refs: Record<string, number>;
  unused: unknown;
  unknown: Array<{ name: string; file: string; line: number; col: number }>;
};

function ensureTempFile(content: string) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  fs.writeFileSync(TEMP_FILE, content, "utf8");
}

afterEach(() => {
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
});

describe("ff-doctor --json output", () => {
  it("produces parseable JSON with refs/unknown/unused fields", () => {
    ensureTempFile(`
      const a = useFlag('betaUI');
      const link = "/api/ff-override?ff=unknownFlag:true";
    `);
    let output = "";
    try {
      output = execFileSync(process.execPath, ["scripts/ff-doctor.mjs", "--json"], {
        encoding: "utf8",
      });
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
  });
});
