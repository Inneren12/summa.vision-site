import { expect, test } from "@playwright/test";

test.describe("viz demo page", () => {
  test("renders without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        errors.push(message.text());
      }
    });

    await page.goto("/viz-demo");

    await expect(
      page.getByRole("heading", { name: "Демо универсального адаптера визуализации" }),
    ).toBeVisible();
    await expect(page.getByRole("group", { name: "Демо визуализации" })).toBeVisible();

    expect(errors).toEqual([]);
  });
});
