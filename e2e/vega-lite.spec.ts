import { expect, test } from "@playwright/test";

import { acceptKlaroConsent } from "./support/consent";

test("vega-lite demo renders and reacts to resize", async ({ page }) => {
  await page.goto("/viz-demo/vega-lite");
  await acceptKlaroConsent(page);

  await page.evaluate(() => {
    window.__vizEvents = [];
    window.addEventListener("viz_state", (event) => {
      if (event instanceof CustomEvent) {
        window.__vizEvents.push(event.detail);
      }
    });
  });

  const chart = page.getByTestId("vega-lite-chart");
  const canvas = chart.locator("canvas");
  await expect(canvas).toBeVisible({ timeout: 15_000 });

  const widthBefore = await canvas.evaluate((node) => node.clientWidth);
  await page.setViewportSize({ width: 900, height: 720 });
  await expect(canvas).toBeVisible();
  const widthAfter = await canvas.evaluate((node) => node.clientWidth);
  expect(widthAfter).toBeGreaterThan(0);
  expect(widthAfter).not.toBeNaN();
  expect(widthAfter).not.toBe(widthBefore);

  await page.getByRole("button", { name: "Beta" }).click();

  await page.waitForFunction(() => {
    return (
      Array.isArray(window.__vizEvents) &&
      window.__vizEvents.some((entry) => entry.selection === "Beta")
    );
  });

  await expect(page.getByTestId("vega-lite-selection-display")).toContainText("Beta");
});

declare global {
  interface Window {
    __vizEvents?: Array<Record<string, unknown>>;
  }
}
