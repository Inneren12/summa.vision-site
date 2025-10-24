import type { SegmentRule } from "../ports";

const globToReg = (g: string) =>
  new RegExp("^" + g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");

export function matches(
  ctx: { tenant?: string; locale?: string; path?: string; ua?: string },
  rule: SegmentRule,
) {
  const { tenant, locale, path, ua } = ctx;
  const { if: cond } = rule;

  if (cond.tenant && (!tenant || !cond.tenant.includes(tenant))) return false;
  if (cond.locale && (!locale || !cond.locale.includes(locale))) return false;
  if (cond.path && (!path || !cond.path.some((g) => globToReg(g).test(path)))) return false;
  if (cond.uaIncludes && (!ua || !cond.uaIncludes.some((s) => ua.includes(s)))) return false;
  return true;
}
