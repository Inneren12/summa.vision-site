import { expect, test } from "@playwright/test";

import { inRollout } from "../../../lib/ff/hash";

import { clearLocalFlags, writeLocalFlags } from "./utils";

async function pickStableIds(percent: number, salt: string) {
  let inId = "";
  let outId = "";
  for (let i = 0; i < 5000 && (!inId || !outId); i += 1) {
    const id = `e2e_user_${i}`;
    const ok = inRollout(id, percent, salt);
    if (ok && !inId) inId = id;
    if (!ok && !outId) outId = id;
  }
  if (!inId || !outId) throw new Error("Failed to sample in/out ids for rollout");
  return { inId, outId };
}

test.describe("Percent rollout (deterministic & stable)", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
    await clearLocalFlags();
  });

  test("25% rollout: stable across reloads and depends on sv_id", async ({
    page,
    context,
    baseURL,
  }) => {
    await writeLocalFlags({ newCheckout: { enabled: true, percent: 25 } });
    const salt = "newCheckout";
    const { inId, outId } = await pickStableIds(25, salt);

    await context.addCookies([{ name: "sv_id", value: inId, url: baseURL!, path: "/" }]);
    await page.goto("/flags-e2e");
    const inFirst = await page.locator('[data-testid="newcheckout-ssr-on"]').isVisible();
    await page.reload();
    const inSecond = await page.locator('[data-testid="newcheckout-ssr-on"]').isVisible();
    expect(inFirst).toBe(true);
    expect(inSecond).toBe(true);

    await context.clearCookies();
    await context.addCookies([{ name: "sv_id", value: outId, url: baseURL!, path: "/" }]);
    await page.goto("/flags-e2e");
    await expect(page.locator('[data-testid="newcheckout-ssr-on"]')).toHaveCount(0);
  });
});
