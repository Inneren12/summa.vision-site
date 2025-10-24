import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("duckdb smoke rowcount", () => {
  it("reports positive rowcounts for processed datasets", () => {
    const reportPath = path.join("reports", "data", "duckdb_smoke_rowcount.test.json");
    if (fs.existsSync(reportPath)) {
      fs.unlinkSync(reportPath);
    }

    const stdout = execFileSync("tools/data/run_duckdb_smoke.py", ["--json-report", reportPath], {
      encoding: "utf8",
    });

    expect(stdout).toMatch(/municipal-budgets-2023/);
    expect(stdout).toMatch(/population-census-2021/);

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    expect(report.summary.failures).toBe(0);
    expect(report.summary.total_files).toBeGreaterThan(0);

    fs.unlinkSync(reportPath);
  });
});
