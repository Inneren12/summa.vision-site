import { test, expect } from "@playwright/test";

test("dash: filters → data (MSW)", async ({ page }) => {
  // (опционально) подключить initScript если используете SW-вариант
  // await page.addInitScript({ path: "apps/web/test/msw/browser-init.js" });

  await page.goto("/dashboards/demo");
  // меняем фильтр страна
  const countrySelect = page.locator("select");
  await countrySelect.selectOption("CA");
  await expect(page).toHaveURL(/f\[country\]=CA/);

  // smoke: проверяем, что сетевые запросы к /api/stories отрабатывают (MSW отвечает)
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/stories") && r.status() === 200),
    page.reload(),
  ]);
  const json = await resp.json();
  expect(Array.isArray(json.items)).toBeTruthy();
});
