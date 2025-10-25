import { FLAG_REGISTRY, isKnownFlag, knownFlags } from "./flags";

export type SchemaReport = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && Object.getPrototypeOf(x) === Object.prototype;
}

function t(v: unknown): string {
  if (v === null) return "null";
  const tp = typeof v;
  if (tp !== "object") return tp;
  return Array.isArray(v) ? "array" : "object";
}

function validateRollout(name: string, v: unknown, errors: string[], warnings: string[]) {
  // Разрешаем boolean (форс‑ON/OFF), но рекомендуем объект
  if (typeof v === "boolean") {
    warnings.push(`${name}: rollout configured as boolean; prefer {enabled, percent?, salt?}`);
    return;
  }
  if (!isPlainObject(v)) {
    errors.push(`${name}: rollout must be object or boolean (got ${t(v)})`);
    return;
  }
  const rollout = v as Record<string, unknown>;
  if (typeof rollout.enabled !== "boolean") errors.push(`${name}: "enabled" must be boolean`);
  if ("percent" in rollout) {
    if (typeof rollout.percent !== "number" || !Number.isFinite(rollout.percent)) {
      errors.push(`${name}: "percent" must be number`);
    } else if (rollout.percent < 0 || rollout.percent > 100) {
      errors.push(`${name}: "percent" out of range [0..100]`);
    }
  }
  if ("salt" in rollout && typeof rollout.salt !== "string") {
    errors.push(`${name}: "salt" must be string`);
  }
  if ("shadow" in rollout && typeof rollout.shadow !== "boolean") {
    errors.push(`${name}: "shadow" must be boolean`);
  }
}

function validateVariant(name: string, v: unknown, errors: string[], warnings: string[]) {
  // override‑строка допускается в cookie/global, НО в ENV ждём объект конфигурации
  if (!isPlainObject(v)) {
    errors.push(`${name}: variant must be object (got ${t(v)})`);
    return;
  }
  const variantConfig = v as Record<string, unknown>;
  const variants = variantConfig.variants as Record<string, unknown> | undefined;
  if (!isPlainObject(variants) || Object.keys(variants).length === 0) {
    errors.push(`${name}: "variants" must be non-empty object`);
    return;
  }
  let sum = 0;
  for (const [k, w] of Object.entries(variants)) {
    if (typeof w !== "number" || !Number.isFinite(w) || w < 0) {
      errors.push(`${name}: variants["${k}"] must be non-negative number`);
    }
    sum += Number(w);
  }
  if (process.env.NODE_ENV === "production") {
    if (Math.abs(sum - 100) > 1e-9)
      errors.push(`${name}: sum(variants) must equal 100 (got ${sum})`);
  } else {
    if (Math.abs(sum - 100) > 1e-6)
      warnings.push(`${name}: sum(variants) is ${sum} (will normalize in dev)`);
  }
  if ("salt" in variantConfig && typeof variantConfig.salt !== "string")
    errors.push(`${name}: "salt" must be string`);
  if ("enabled" in variantConfig && typeof variantConfig.enabled !== "boolean")
    errors.push(`${name}: "enabled" must be boolean`);
  if ("defaultVariant" in variantConfig) {
    if (typeof variantConfig.defaultVariant !== "string") {
      errors.push(`${name}: "defaultVariant" must be string`);
    } else if (isPlainObject(variants) && !(variantConfig.defaultVariant in variants)) {
      warnings.push(`${name}: "defaultVariant" not in variants`);
    }
  }
}

/** Валидирует объект ENV‑флагов против реестра. */
export function validateFeatureFlagsObject(obj: unknown): SchemaReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (obj === undefined) {
    return { ok: true, errors, warnings };
  }
  if (!isPlainObject(obj)) {
    errors.push(`FEATURE_FLAGS_JSON must be object (got ${t(obj)})`);
    return { ok: errors.length === 0, errors, warnings };
  }

  for (const [name, val] of Object.entries(obj)) {
    if (!isKnownFlag(name)) {
      // Для ENV — предупреждение (не ломаем запуск), строгий режим — опционально в будущем.
      warnings.push(`Unknown flag in ENV: "${name}" (known: ${knownFlags().join(", ")})`);
      continue;
    }
    const meta = FLAG_REGISTRY[name];
    switch (meta.type) {
      case "boolean":
        if (typeof val !== "boolean") errors.push(`${name}: must be boolean (got ${t(val)})`);
        break;
      case "string":
        if (typeof val !== "string") errors.push(`${name}: must be string (got ${t(val)})`);
        else if (val.length > 256) errors.push(`${name}: string too long (>256)`);
        break;
      case "number":
        if (typeof val !== "number" || !Number.isFinite(val))
          errors.push(`${name}: must be number`);
        else if (val < -1e6 || val > 1e6) errors.push(`${name}: number out of range [-1e6..1e6]`);
        break;
      case "rollout":
        validateRollout(name, val, errors, warnings);
        break;
      case "variant":
        validateVariant(name, val, errors, warnings);
        break;
      default:
        warnings.push(`${name}: unsupported type in registry`);
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

/** Парсит JSON‑строку ENV и возвращает отчёт валидации (без утечки содержимого). */
export function validateFeatureFlagsEnvString(envJson?: string | null): SchemaReport {
  if (!envJson || envJson.trim() === "") return { ok: true, errors: [], warnings: [] };
  try {
    const obj = JSON.parse(envJson);
    return validateFeatureFlagsObject(obj);
  } catch {
    return { ok: false, errors: ["FEATURE_FLAGS_JSON: malformed JSON"], warnings: [] };
  }
}

// Единоразовый dev‑варнинг при изменении ENV (без утечки содержимого).
let __lastSig: string | undefined;
export function devWarnFeatureFlagsSchemaOnce() {
  if (process.env.NODE_ENV === "production") return;
  const sig =
    String(process.env.FEATURE_FLAGS_JSON || "").length +
    ":" +
    (process.env.FEATURE_FLAGS_JSON || "").slice(0, 2);
  if (sig === __lastSig) return;
  __lastSig = sig;
  const report = validateFeatureFlagsEnvString(process.env.FEATURE_FLAGS_JSON);
  if (!report.ok || report.warnings.length) {
    // eslint-disable-next-line no-console
    console.warn("[flags][schema]", {
      ok: report.ok,
      errors: report.errors,
      warnings: report.warnings,
    });
  }
}
