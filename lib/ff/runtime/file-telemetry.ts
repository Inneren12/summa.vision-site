import fs from "node:fs";
import path from "node:path";

import { trackFlagEvaluation, type TelemetryEvent } from "../telemetry";

type WriteQueueTask = () => Promise<void>;

export class FileTelemetrySink {
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  emit(event: TelemetryEvent): void {
    try {
      trackFlagEvaluation(event);
    } catch {
      // ignore telemetry fallback errors
    }
    this.enqueue(async () => {
      const dir = path.dirname(this.filePath);
      await fs.promises.mkdir(dir, { recursive: true });
      const line = `${JSON.stringify(event)}\n`;
      await fs.promises.appendFile(this.filePath, line, "utf8");
    });
  }

  private enqueue(task: WriteQueueTask) {
    this.queue = this.queue.then(task).catch(() => undefined);
  }
}
