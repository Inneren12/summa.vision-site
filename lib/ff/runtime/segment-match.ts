import type {
  FlagEvaluationContext,
  LegacySegmentCondition,
  SegmentConfig,
  SegmentWhere,
} from "./types";

const FIELD_ALIASES: Record<string, string> = {
  user: "userId",
  namespace: "namespace",
  cookie: "cookieId",
  ip: "ip",
  ua: "userAgent",
  path: "path",
  stableId: "stableId",
};

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .split("")
    .map((char, index, arr) => {
      if (char === "*") {
        // Collapse consecutive * into a single pattern to avoid exponential regexes.
        let stars = 1;
        while (arr[index + stars] === "*") stars += 1;
        return stars > 1 ? "(?:.*)" : ".*";
      }
      if (char === "?") return ".";
      return escapeRegex(char);
    })
    .join("");
  return new RegExp(`^${escaped}$`);
}

function resolveFieldValue(ctx: FlagEvaluationContext, field: string): unknown {
  if (field === "tag" || field === "tags") {
    return ctx.tags;
  }
  const mapped = FIELD_ALIASES[field] ?? field;
  const segments = mapped.split(".");
  let current: unknown = ctx as Record<string, unknown>;
  for (const segment of segments) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function matchesStringValue(value: unknown, predicate: (value: string) => boolean): boolean {
  if (typeof value === "string") {
    return predicate(value);
  }
  if (Array.isArray(value)) {
    return value.some((item) => typeof item === "string" && predicate(item));
  }
  return false;
}

function matchesStringSet(value: unknown, candidates: string[], negate = false): boolean {
  if (!Array.isArray(candidates) || candidates.length === 0) return false;
  if (typeof value === "string") {
    const contains = candidates.includes(value);
    return negate ? !contains : contains;
  }
  if (Array.isArray(value)) {
    const hasIntersection = value.some(
      (item) => typeof item === "string" && candidates.includes(item),
    );
    return negate ? !hasIntersection : hasIntersection;
  }
  return false;
}

function matchesClause(where: SegmentWhere, ctx: FlagEvaluationContext): boolean {
  const value = resolveFieldValue(ctx, where.field);

  switch (where.op) {
    case "eq": {
      if (typeof where.value === "number") {
        if (Array.isArray(value)) {
          return value.some((item) => typeof item === "number" && item === where.value);
        }
        return typeof value === "number" && value === where.value;
      }
      const stringValue = where.value;
      if (Array.isArray(value)) {
        return value.some((item) => typeof item === "string" && item === stringValue);
      }
      if (typeof value === "string") {
        return value === stringValue;
      }
      return false;
    }
    case "startsWith":
      return matchesStringValue(value, (input) => input.startsWith(where.value));
    case "contains":
      return matchesStringValue(value, (input) => input.includes(where.value));
    case "in":
      return matchesStringSet(value, where.values, false);
    case "notIn":
      return matchesStringSet(value, where.values, true);
    case "gt":
      if (Array.isArray(value)) {
        return value.some((item) => typeof item === "number" && item > where.value);
      }
      return typeof value === "number" && value > where.value;
    case "lt":
      if (Array.isArray(value)) {
        return value.some((item) => typeof item === "number" && item < where.value);
      }
      return typeof value === "number" && value < where.value;
    case "between": {
      const { min, max } = where;
      if (Array.isArray(value)) {
        return value.some((item) => typeof item === "number" && item >= min && item <= max);
      }
      return typeof value === "number" && value >= min && value <= max;
    }
    case "glob":
      if (!value) return false;
      if (Array.isArray(value)) {
        return value.some(
          (item) => typeof item === "string" && globToRegExp(where.value).test(item),
        );
      }
      return typeof value === "string" && globToRegExp(where.value).test(value);
    default:
      return false;
  }
}

export function legacyConditionToWhere(condition: LegacySegmentCondition): SegmentWhere {
  return { field: condition.field, op: "eq", value: condition.value } satisfies SegmentWhere;
}

export function normalizeSegmentWhere(segment: SegmentConfig): SegmentWhere[] | undefined {
  if (segment.where && segment.where.length > 0) {
    return segment.where;
  }
  if (segment.conditions && segment.conditions.length > 0) {
    return segment.conditions.map((condition) => legacyConditionToWhere(condition));
  }
  return undefined;
}

export function matchesSegment(segment: SegmentConfig, ctx: FlagEvaluationContext): boolean {
  const clauses = normalizeSegmentWhere(segment);
  if (!clauses || clauses.length === 0) {
    return true;
  }
  return clauses.every((clause) => matchesClause(clause, ctx));
}
