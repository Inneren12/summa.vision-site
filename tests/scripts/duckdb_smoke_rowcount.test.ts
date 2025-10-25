import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("duckdb smoke rowcount", () => {
  it("reports positive rowcounts for processed datasets", () => {
    const pythonCandidates = [process.env.PYTHON ?? "python3", "python"];
    let duckdbAvailable = false;
    for (const cmd of pythonCandidates) {
      if (!cmd) continue;
      const check = spawnSync(cmd, ["-c", "import duckdb"], { stdio: "pipe" });
      if (check.status === 0) {
        duckdbAvailable = true;
        break;
      }
      if (check.error && (check.error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }
      const stderr = check.stderr?.toString() ?? "";
      if (!stderr.includes("duckdb")) {
        console.warn(`[duckdb_smoke] skipping check: ${stderr}`.trim());
      }
    }

    if (!duckdbAvailable) {
      console.warn(
        "[duckdb_smoke] skipping check: Python 'duckdb' package is not available in this environment.",
      );
      return;
    }

    const reportPath = path.join("reports", "data", "duckdb_smoke_rowcount.test.json");
    if (fs.existsSync(reportPath)) {
      fs.unlinkSync(reportPath);
    }

    let stdout: string;
    try {
      stdout = execFileSync("tools/data/run_duckdb_smoke.py", ["--json-report", reportPath], {
        encoding: "utf8",
      });
    } catch (error) {
      const message =
        (error && typeof error === "object" && "stderr" in error
          ? String((error as { stderr?: Buffer | string }).stderr ?? "")
          : error instanceof Error
            ? error.message
            : String(error)) || "";
      if (message.includes("duckdb")) {
        console.warn(
          "[duckdb_smoke] skipping check: Python 'duckdb' package is not available in this environment.",
        );
        return;
      }
      throw error;
    }

    expect(stdout).toMatch(/municipal-budgets-2023/);
    expect(stdout).toMatch(/population-census-2021/);

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    expect(report.summary.failures).toBe(0);
    expect(report.summary.total_files).toBeGreaterThan(0);

    fs.unlinkSync(reportPath);
  });
});
