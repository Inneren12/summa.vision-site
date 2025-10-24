import fs from "node:fs";
import path from "node:path";

import { describe, it, expect, beforeAll } from "vitest";

import { SelfHostedMetricsProvider } from "../../lib/ff/metrics/self";

const vitals = path.resolve("./.runtime/test-vitals.ndjson");
const errors = path.resolve("./.runtime/test-errors.ndjson");

describe("SelfHostedMetricsProvider", () => {
  beforeAll(() => {
    fs.mkdirSync(path.dirname(vitals), { recursive: true });
    fs.writeFileSync(vitals, "");
    fs.writeFileSync(errors, "");
    const pushVital = (val: number) =>
      fs.appendFileSync(
        vitals,
        JSON.stringify({ ts: Date.now(), name: "INP", value: val, snap: "public:feature.X=on" }) +
          "\n",
      );
    [50, 70, 90, 110, 150, 180, 200, 210, 400].forEach(pushVital);
    fs.appendFileSync(
      errors,
      JSON.stringify({ ts: Date.now(), type: "js_error", snap: "public:feature.X=on" }) + "\n",
    );
  });

  it("computes p75 and errorRate", async () => {
    const metrics = SelfHostedMetricsProvider({ vitalsFile: vitals, errorsFile: errors });
    const p75 = await metrics.getWebVital("INP", "feature.X", "public", 60_000);
    const er = await metrics.getErrorRate("feature.X", "public", 60_000);

    expect(p75).toBeGreaterThanOrEqual(180);
    expect(p75).toBeLessThanOrEqual(210);
    expect(er).toBeGreaterThan(0);
    expect(er).toBeLessThan(1);
  });
});
