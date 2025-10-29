import { expect, test } from "../../../e2e/fixtures";

test.describe("middleware sv_id creation", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("creates sv_id on first visit", async ({ page, context }) => {
    await page.goto("/flags-e2e");
    const cookies = await context.cookies();
    const sv = cookies.find((c) => c.name === "sv_id");
    expect(sv).toBeDefined();
    expect(sv?.value).toBeTruthy();
    expect(sv?.path).toBe("/");
  });
});
