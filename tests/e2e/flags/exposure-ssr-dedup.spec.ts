import { expect, test } from "@playwright/test";

type TelemetryResponse = {
  events?: Array<{ type?: string; flag?: string }>;
};

function countExposureEvents(payload: TelemetryResponse): number {
  if (!Array.isArray(payload.events)) return 0;
  return payload.events.filter((event) => event.type === "exposure" && event.flag === "betaUI")
    .length;
}

test.describe("Exposure SSR dedup", () => {
  test("records single exposure for multiple identical gates", async ({ page }) => {
    await page.goto("/api/ff-override?ff=betaUI:true");
    await page.waitForLoadState("networkidle");

    const beforeResponse = await page.request.get("/api/dev/flags-events");
    const beforeJson = (await beforeResponse.json()) as TelemetryResponse;
    const beforeCount = countExposureEvents(beforeJson);

    await page.goto("/dev/exposure-test");
    await expect(page.getByTestId("exp-a")).toBeVisible();
    await expect(page.getByTestId("exp-b")).toBeVisible();
    await expect(page.getByTestId("exp-c")).toBeVisible();

    const afterResponse = await page.request.get("/api/dev/flags-events");
    const afterJson = (await afterResponse.json()) as TelemetryResponse;
    const afterCount = countExposureEvents(afterJson);

    expect(afterCount - beforeCount).toBe(1);
  });
});
