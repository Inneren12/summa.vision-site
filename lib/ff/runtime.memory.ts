import fs from "node:fs";
import path from "node:path";

import type { TelemetrySink, MetricsProvider } from "./core/ports";
import { MemoryStore } from "./core/store/memory";
import { SelfHostedMetricsProvider } from "./metrics/self";

export function composeMemoryRuntime() {
  const store = new MemoryStore();

  const telemetry: TelemetrySink = {
    async emit(e) {
      const target = process.env.TELEMETRY_FILE || "./.runtime/telemetry.ndjson";
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.appendFileSync(target, JSON.stringify(e) + "\n");
    },
  };

  const metrics: MetricsProvider =
    process.env.METRICS_PROVIDER === "self"
      ? SelfHostedMetricsProvider({
          vitalsFile: process.env.METRICS_VITALS_FILE,
          errorsFile: process.env.METRICS_ERRORS_FILE,
        })
      : {
          async getErrorRate() {
            return null;
          },
          async getWebVital() {
            return null;
          },
        };

  return { store, telemetry, metrics };
}
