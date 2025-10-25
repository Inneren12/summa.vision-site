import { spawnSync } from "child_process";
import { mkdtempSync, writeFileSync, utimesSync, mkdirSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { describe, expect, it } from "vitest";

const DAY_IN_SECONDS = 24 * 60 * 60;

const createDatasetFile = (base: string, id: string, ageInDays: number, now: number) => {
  const dir = join(base, id);
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, "data.csv");
  writeFileSync(filePath, "id,value\n1,2\n");

  const mtime = now - ageInDays * DAY_IN_SECONDS;
  utimesSync(filePath, mtime, mtime);
};

const runValidator = (
  catalogPath: string,
  rawDir: string,
  now: number,
  extraArgs: string[] = [],
) => {
  return spawnSync(
    "bash",
    [
      "data_validate.sh",
      "--catalog",
      catalogPath,
      "--raw-dir",
      rawDir,
      "--now",
      String(now),
      ...extraArgs,
    ],
    {
      encoding: "utf8",
    },
  );
};

describe("data freshness validator", () => {
  it("passes when all datasets are within the SLA", () => {
    const workdir = mkdtempSync(join(tmpdir(), "freshness-pass-"));
    const rawDir = join(workdir, "raw");
    const catalogPath = join(workdir, "catalog.yml");
    const now = 10 * DAY_IN_SECONDS;

    mkdirSync(rawDir, { recursive: true });
    createDatasetFile(rawDir, "fresh-dataset", 2, now);

    const catalog = [
      "datasets:",
      "  - id: fresh-dataset",
      "    sla_days: 5",
      "    license:",
      "      id: CC-BY-4.0",
      "      url: https://example.com/licenses/cc-by-4.0",
      "    source:",
      "      url: https://example.com/datasets/fresh",
    ].join("\n");
    writeFileSync(catalogPath, catalog);

    const result = runValidator(catalogPath, rawDir, now);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("All datasets are within the freshness SLA");
  });

  it("fails and lists datasets that exceed the SLA", () => {
    const workdir = mkdtempSync(join(tmpdir(), "freshness-fail-"));
    const rawDir = join(workdir, "raw");
    const catalogPath = join(workdir, "catalog.yml");
    const now = 100 * DAY_IN_SECONDS;

    mkdirSync(rawDir, { recursive: true });
    createDatasetFile(rawDir, "fresh-dataset", 1, now);
    createDatasetFile(rawDir, "stale-dataset", 20, now);

    const catalog = [
      "datasets:",
      "  - id: fresh-dataset",
      "    sla_days: 10",
      "    license:",
      "      id: CC-BY-4.0",
      "      url: https://example.com/licenses/cc-by-4.0",
      "    source:",
      "      url: https://example.com/datasets/fresh",
      "  - id: stale-dataset",
      "    sla_days: 5",
      "    license:",
      "      id: CC0-1.0",
      "      url: https://example.com/licenses/cc0-1.0",
      "    source:",
      "      url: https://example.com/datasets/stale",
    ].join("\n");
    writeFileSync(catalogPath, catalog);

    const result = runValidator(catalogPath, rawDir, now);

    expect(result.status).toBe(1);
    const combinedOutput = `${result.stdout}${result.stderr}`;
    expect(combinedOutput).toContain("Datasets exceeding freshness SLA");
    expect(combinedOutput).toContain("stale-dataset");
  });

  it("writes a JSON report when requested", () => {
    const workdir = mkdtempSync(join(tmpdir(), "freshness-json-"));
    const rawDir = join(workdir, "raw");
    const catalogPath = join(workdir, "catalog.yml");
    const reportPath = join(workdir, "report.json");
    const now = 5 * DAY_IN_SECONDS;

    mkdirSync(rawDir, { recursive: true });
    createDatasetFile(rawDir, "json-dataset", 2, now);

    const catalog = ["datasets:", "  - id: json-dataset", "    sla_days: 5"].join("\n");
    writeFileSync(catalogPath, catalog);

    const result = runValidator(catalogPath, rawDir, now, ["--json-report", reportPath]);

    expect(result.status).toBe(0);

    const report = JSON.parse(readFileSync(reportPath, "utf8"));
    expect(report.success).toBe(true);
    expect(report.summary.total).toBe(1);
    expect(report.datasets[0].id).toBe("json-dataset");
    expect(report.datasets[0].status).toBe("ok");
  });
});
