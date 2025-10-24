import { trackFlagEvaluation, type TelemetryEvent } from "./telemetry";

type TelemetrySink = { emit: (event: TelemetryEvent) => void };

type RuntimeShape = {
  telemetrySink: TelemetrySink;
};

let runtime: RuntimeShape | null = null;

function createDefaultRuntime(): RuntimeShape {
  return {
    telemetrySink: {
      emit(event: TelemetryEvent) {
        trackFlagEvaluation(event);
      },
    },
  };
}

export function FF(): RuntimeShape {
  if (!runtime) {
    runtime = createDefaultRuntime();
  }
  return runtime;
}

export function composeFFRuntime(overrides?: { telemetry?: TelemetrySink }): RuntimeShape {
  runtime = {
    telemetrySink: overrides?.telemetry ?? createDefaultRuntime().telemetrySink,
  };
  return runtime;
}

export function resetFFRuntime() {
  runtime = null;
}
