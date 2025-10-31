import { test, expect } from "@playwright/test";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const storiesFixture = require("./fixtures/stories.json");

test("dash: filters → data (MSW)", async ({ page }) => {
  await page.route("**/api/stories**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(storiesFixture),
    });
  });

  await page.goto("/dashboards/demo");
  await page.waitForLoadState("networkidle");

  const countrySelect = page.locator("select");
  await countrySelect.selectOption("CA");
  await expect(page).toHaveURL(/f\[country\]=CA/);

  await page.reload({ waitUntil: "networkidle" });

  const data = await page.evaluate(async () => {
    const res = await fetch("/api/stories?probe=after-reload", { cache: "no-store" });
    return res.json();
  });

  expect(Array.isArray(data.items)).toBe(true);
});
