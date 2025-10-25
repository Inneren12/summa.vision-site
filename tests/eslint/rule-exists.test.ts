import { Linter } from "eslint";
import { describe, it, expect } from "vitest";

async function loadPlugin() {
  const mod = await import("../../tools/eslint-plugin-ff-safe/index.cjs");
  return (mod && mod.default) || mod;
}

async function runRule(ruleName: string, code: string, filePath = "test.tsx") {
  const plugin = await loadPlugin();
  if (!plugin || !plugin.rules?.[ruleName]) {
    throw new Error(`Rule ${ruleName} not found on plugin`);
  }
  const linter = new Linter();
  const fullRuleName = `ff-safe/${ruleName}`;
  linter.defineRule(fullRuleName, plugin.rules[ruleName]);
  return linter.verify(
    code,
    {
      parserOptions: { ecmaVersion: 2022, sourceType: "module" },
      rules: { [fullRuleName]: "error" },
    },
    filePath,
  );
}

describe("eslint-plugin-ff-safe", () => {
  it("exposes the expected rules", async () => {
    const plugin = await loadPlugin();
    expect(plugin).toBeTruthy();
    expect(Object.keys(plugin.rules ?? {})).toEqual(
      expect.arrayContaining([
        "no-ff-server-in-client",
        "no-dynamic-ff-key",
        "no-telemetry-in-server",
      ]),
    );
  });

  it("reports server flag API usage in client modules", async () => {
    const messages = await runRule(
      "no-ff-server-in-client",
      `'use client';\nimport { getFlagServer } from "@/lib/ff/effective.server";\ngetFlagServer("betaUI");`,
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]?.ruleId).toBe("ff-safe/no-ff-server-in-client");
  });

  it("reports dynamic flag keys", async () => {
    const messages = await runRule(
      "no-dynamic-ff-key",
      'import { getFlag } from "@/lib/ff/server";\nconst suffix = Math.random();\ngetFlag(`beta-${suffix}`);',
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]?.ruleId).toBe("ff-safe/no-dynamic-ff-key");
  });

  it("reports client telemetry imports in server modules", async () => {
    const messages = await runRule(
      "no-telemetry-in-server",
      'import { trackExposureClient } from "@/lib/ff/exposure.client";\ntrackExposureClient({ flag: "betaUI", value: true, source: "env" });',
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]?.ruleId).toBe("ff-safe/no-telemetry-in-server");
  });

  it("allows telemetry imports inside client modules", async () => {
    const messages = await runRule(
      "no-telemetry-in-server",
      `'use client';\nimport { trackExposureClient } from "@/lib/ff/exposure.client";`,
    );
    expect(messages).toHaveLength(0);
  });

  it("allows telemetry imports when file is marked shared", async () => {
    const messages = await runRule(
      "no-telemetry-in-server",
      `// @ff-safe shared\nimport { trackExposureClient } from "@/lib/ff/exposure.client";`,
    );
    expect(messages).toHaveLength(0);
  });
});
