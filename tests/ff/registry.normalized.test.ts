import { describe, it, expect } from "vitest";

import { FLAG_REGISTRY } from "@/lib/ff/flags";
import { ROLLOUT_NAMES, ROLLOUT_DEFAULTS } from "@/lib/ff/registry.normalized";

describe("registry.normalized", () => {
  it("has rollout defaults with salt fallback to flag name", () => {
    for (const name of ROLLOUT_NAMES) {
      const defaults = ROLLOUT_DEFAULTS[name];
      expect(defaults).toBeTruthy();
      expect(typeof defaults.salt).toBe("string");
      expect(defaults.salt.length).toBeGreaterThan(0);

      const definition = FLAG_REGISTRY[name];
      const def = definition.defaultValue as { enabled?: boolean } | undefined;
      const expectedEnabled = !!def?.enabled;
      expect(defaults.enabled).toBe(expectedEnabled);
    }
  });
});
