type MetricKey =
  | "override.429"
  | "override.403"
  | "override.403.crossSite"
  | "override.400.unknown"
  | "override.400.type";

const COUNTERS: Record<MetricKey, number> = {
  "override.429": 0,
  "override.403": 0,
  "override.403.crossSite": 0,
  "override.400.unknown": 0,
  "override.400.type": 0,
};

export function inc(key: MetricKey, by = 1) {
  COUNTERS[key] = (COUNTERS[key] ?? 0) + by;
}
export function snapshot(): Readonly<Record<MetricKey, number>> {
  // возвращаем копию, чтобы снаружи не мутировали
  return { ...COUNTERS };
}
// tests/dev only
export function __resetMetrics() {
  (Object.keys(COUNTERS) as MetricKey[]).forEach((k) => (COUNTERS[k] = 0));
}
