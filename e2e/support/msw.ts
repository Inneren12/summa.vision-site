import { test as base, expect } from "@playwright/test";

const mswBundlePath = process.env.PW_MSW_BUNDLE_PATH ?? "";
const preferReducedMotion = (process.env.PW_MSW_REDUCED_MOTION ?? "").toLowerCase();

export const test = base.extend({
  context: async ({ context }, use) => {
    if (mswBundlePath) {
      await context.addInitScript({ path: mswBundlePath });
    }
    await use(context);
  },
  page: async ({ page }, use) => {
    if (preferReducedMotion === "1" || preferReducedMotion === "true") {
      await page.emulateMedia({ reducedMotion: "reduce" });
    }
    await use(page);
  },
});

export { expect };
