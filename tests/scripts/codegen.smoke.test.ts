import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { describe, it, expect } from "vitest";

function read(p: string) {
  return fs.readFileSync(p, "utf8");
}

function withFixture(content: string, fn: () => void) {
  const flagsPath = path.join(process.cwd(), "lib", "ff", "flags.ts");
  const original = fs.existsSync(flagsPath) ? fs.readFileSync(flagsPath, "utf8") : null;
  fs.mkdirSync(path.dirname(flagsPath), { recursive: true });
  fs.writeFileSync(flagsPath, content, "utf8");

  const targets = [
    path.join("types", "flags.generated.d.ts"),
    path.join("docs", "flags.generated.md"),
    path.join("generated", "flags.names.json"),
  ];
  const backups = new Map<string, string | null>();
  for (const target of targets) {
    backups.set(target, fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null);
  }

  try {
    fn();
  } finally {
    if (original === null) {
      if (fs.existsSync(flagsPath)) fs.unlinkSync(flagsPath);
    } else {
      fs.writeFileSync(flagsPath, original, "utf8");
    }
    for (const target of targets) {
      const prev = backups.get(target) ?? null;
      if (prev === null) {
        if (fs.existsSync(target)) fs.unlinkSync(target);
      } else {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, prev, "utf8");
      }
    }
  }
}

describe("ff-codegen CLI", () => {
  it("generates d.ts, md and names.json", () => {
    const flagsTs = `
      export type FlagName = 'betaUI' | 'bannerText';
      export const FLAG_REGISTRY = {
        betaUI: { type:'boolean', defaultValue:false, owner:'team-design', description:'Beta' },
        bannerText: { type:'string', defaultValue:'', owner:'team-marketing', description:'Banner' },
      } as const;
    `;

    withFixture(flagsTs, () => {
      execFileSync(process.execPath, ["scripts/ff-codegen.mjs"], { stdio: "inherit" });

      const dts = read(path.join("types", "flags.generated.d.ts"));
      const md = read(path.join("docs", "flags.generated.md"));
      const json = JSON.parse(read(path.join("generated", "flags.names.json")));

      expect(dts).toMatch(/GeneratedFlagTypeMap/);
      expect(dts).toMatch(/betaUI:\s*EffectiveValueFor<"betaUI">/);
      expect(md).toMatch(/\| betaUI \| boolean \|/);
      expect(json.names).toEqual(expect.arrayContaining(["betaUI", "bannerText"]));
    });
  });
});
