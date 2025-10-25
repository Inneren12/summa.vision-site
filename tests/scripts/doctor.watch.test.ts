import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const TEMP_DIR = path.join(process.cwd(), "app", "__doctor_watch__");
const TEMP_FILE = path.join(TEMP_DIR, "index.tsx");

function ensureTempFile(content: string) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  fs.writeFileSync(TEMP_FILE, content, "utf8");
}

afterEach(() => {
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
});

describe("ff-doctor --watch output", () => {
  it("emits NDJSON lines with run payloads", async () => {
    ensureTempFile(`
      export const Sample = () => {
        const flag = useFlag('bannerText');
        return <div>{flag ? 'on' : 'off'}</div>;
      };
    `);

    const child = spawn(process.execPath, ["scripts/ff-doctor.mjs", "--watch", "--days=0"], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", () => {
      // drain stderr to avoid blocking
    });

    let buffer = "";
    const events: Array<Record<string, unknown>> = [];

    const runEvent = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("timeout waiting for ff-doctor watch run event"));
      }, 15000);

      child.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      child.stdout.on("data", (chunk: string) => {
        buffer += chunk;
        let index = buffer.indexOf("\n");
        while (index !== -1) {
          const line = buffer.slice(0, index).trim();
          buffer = buffer.slice(index + 1);
          if (line.length === 0) {
            index = buffer.indexOf("\n");
            continue;
          }
          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(line) as Record<string, unknown>;
          } catch (error) {
            clearTimeout(timeout);
            reject(new Error(`invalid NDJSON line: ${line}`));
            return;
          }
          events.push(parsed);
          if (parsed.type === "run") {
            clearTimeout(timeout);
            resolve(parsed);
            return;
          }
          index = buffer.indexOf("\n");
        }
      });
    });

    expect(runEvent).toHaveProperty("result");
    const result = runEvent.result as Record<string, unknown>;
    expect(Array.isArray(result.unused)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);

    const unused = result.unused as Array<Record<string, unknown>>;
    unused.forEach((entry) => {
      const confidence = entry.confidence;
      if (confidence !== undefined) {
        expect(["high", "medium", "low"]).toContain(confidence);
      }
    });

    child.kill("SIGINT");
    await once(child, "exit");

    events.forEach((event) => {
      expect(typeof event).toBe("object");
    });
  }, 20000);
});
