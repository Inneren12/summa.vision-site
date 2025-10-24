import type { FlagStore, FlagConfig, OverrideKey, OverrideValue, Percent } from "../ports";

export class MemoryStore implements FlagStore {
  private flags = new Map<string, FlagConfig>(); // `${ns}:${key}`
  private overrides = new Map<string, OverrideValue>(); // `${ns}|${user}|${flag}`
  private locks = new Map<string, number>();
  private rollouts = new Map<string, number>();

  private flagKey(ns: string, key: string) {
    return `${ns}:${key}`;
  }

  private overrideKey(key: OverrideKey) {
    const ns = key.namespace ?? "*";
    const user = key.userId ?? "*";
    return `${ns}|${user}|${key.flag}`;
  }

  private applyRollout(cfg: FlagConfig): FlagConfig {
    const pct = this.rollouts.get(this.flagKey(cfg.namespace, cfg.key));
    if (typeof pct !== "number") return cfg;
    const next = cfg.rollout ?? { steps: [] };
    const steps = next.steps && next.steps.length > 0 ? [...next.steps] : [];
    if (steps.length === 0) {
      steps.push({ pct });
    } else {
      steps[0] = { ...steps[0], pct };
    }
    return { ...cfg, rollout: { ...next, steps } };
  }

  async getFlag(key: string, ns: string) {
    const cfg = this.flags.get(this.flagKey(ns, key));
    return cfg ? this.applyRollout(cfg) : null;
  }

  async putFlag(cfg: FlagConfig) {
    this.flags.set(this.flagKey(cfg.namespace, cfg.key), cfg);
  }

  async listFlags(ns?: string) {
    const all = [...this.flags.values()].filter((f) => !ns || f.namespace === ns);
    return all.map((f) => this.applyRollout(f));
  }

  async setOverride(key: OverrideKey, v: OverrideValue) {
    this.overrides.set(this.overrideKey(key), v);
  }

  async getOverrides(filter: Partial<OverrideKey>) {
    const out: Record<string, OverrideValue> = {};
    for (const [k, v] of this.overrides.entries()) {
      const [ns, user, flag] = k.split("|");
      if (filter.flag && flag !== filter.flag) continue;
      if (filter.namespace && ns !== "*" && ns !== filter.namespace) continue;
      if (filter.userId && user !== "*" && user !== filter.userId) continue;
      out[k] = v;
    }
    return out;
  }

  async setRolloutStep(key: string, ns: string, pct: Percent) {
    this.rollouts.set(this.flagKey(ns, key), pct);
  }

  async withLock<T>(lockKey: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const until = this.locks.get(lockKey) ?? 0;
    if (until > now) throw new Error("locked");
    this.locks.set(lockKey, now + ttlMs);
    try {
      return await fn();
    } finally {
      this.locks.delete(lockKey);
    }
  }
}
