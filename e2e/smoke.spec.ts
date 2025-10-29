import { expect, test } from "./fixtures";
import { acceptKlaroConsent } from "./support/consent";

test("home to healthz smoke", async ({ page }) => {
  await page.goto("/");
  await acceptKlaroConsent(page);

  const healthzLink = page.getByRole("link", { name: "/healthz" });
  await expect(healthzLink).toBeVisible();

  const apiResponse = await page.request.get("/api/healthz");
  expect(apiResponse.ok()).toBeTruthy();
  const json = await apiResponse.json();
  expect(json.status).toBe("ok");
  expect(typeof json.ts).toBe("string");

  await healthzLink.click();

  const main = page.getByRole("main");
  await expect(main.locator("pre")).toContainText('"status": "ok"', { timeout: 15_000 });
  await expect(main.locator("pre")).toContainText('"ts":', { timeout: 15_000 });
});
