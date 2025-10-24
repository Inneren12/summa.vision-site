import fs from "node:fs";
import path from "node:path";

import { describe, it, expect } from "vitest";

import {
  readFlagRegistryObject,
  readFlagNamesFromUnion,
} from "../../scripts/codegen/extract-registry.js";
import { stripComments } from "../../scripts/utils/strip-comments.js";

const sample = `
  // comments should be ignored
  export type FlagName = 'betaUI' | 'bannerText' | 'newCheckout';
  export const FLAG_REGISTRY: Record<FlagName, any> = {
    betaUI: { type:'boolean', defaultValue:false, owner:'team-design', description:'Beta UI' },
    bannerText: { type:'string', defaultValue:'', owner:'team-marketing', description:'Homepage banner' },
    newCheckout: { type:'rollout', defaultValue:{ enabled:false }, owner:'team-payments' },
  } as const;
`;

function withTempFlagsTs(content: string, fn: () => void) {
  const p = path.join(process.cwd(), "lib", "ff", "flags.ts");
  const dir = path.dirname(p);
  fs.mkdirSync(dir, { recursive: true });
  const orig = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
  fs.writeFileSync(p, content, "utf8");
  try {
    fn();
  } finally {
    if (orig !== null) {
      fs.writeFileSync(p, orig, "utf8");
    } else if (fs.existsSync(p)) {
      fs.unlinkSync(p);
    }
  }
}

describe("extract-registry", () => {
  it("stripComments keeps strings and removes comments", () => {
    const out = stripComments(`"http://x//y" /* z */ // k\n1`);
    expect(out).toContain("http://x//y");
    expect(out).not.toContain("/* z */");
  });

  it("reads registry object literal and names union", () => {
    withTempFlagsTs(sample, () => {
      const reg = readFlagRegistryObject();
      expect(reg).toHaveProperty("betaUI");
      expect(reg.bannerText.type).toBe("string");
      const names = readFlagNamesFromUnion();
      expect(names).toEqual(expect.arrayContaining(["betaUI", "bannerText", "newCheckout"]));
    });
  });
});
