import { expect, test } from "@playwright/test";

const CONTAINER_SELECTOR = "[data-testid='map-container']";

test.describe("Map resize", () => {
  test("canvas follows container after viewport changes", async ({ page }) => {
    await page.goto("/e2e/map");

    const container = page.locator(CONTAINER_SELECTOR);
    await expect(container).toBeVisible();

    await page.waitForSelector("[data-testid='map-container'][data-e2e-ready='1']", {
      timeout: 30000,
    });

    const canvas = container.locator("canvas").first();
    await expect(canvas).toBeAttached({ timeout: 30000 });

    await page.waitForFunction(
      () => {
        const canvasEl = document.querySelector<HTMLCanvasElement>(
          "[data-testid='map-container'] canvas",
        );
        const mapContainer = document.querySelector<HTMLElement>("[data-testid='map-container']");
        if (!canvasEl || !mapContainer) return false;
        const canvasRect = canvasEl.getBoundingClientRect();
        const containerRect = mapContainer.getBoundingClientRect();
        return (
          Math.abs(canvasRect.width - containerRect.width) <= 1 &&
          Math.abs(canvasRect.height - containerRect.height) <= 1
        );
      },
      { timeout: 30000 },
    );

    const [box, canvasSize] = await Promise.all([
      container.boundingBox(),
      canvas.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }),
    ]);

    expect(box).toBeTruthy();
    expect(canvasSize.width).toBeGreaterThan(0);
    expect(canvasSize.height).toBeGreaterThan(0);
    expect(Math.abs((box?.width ?? 0) - canvasSize.width)).toBeLessThanOrEqual(1);
    expect(Math.abs((box?.height ?? 0) - canvasSize.height)).toBeLessThanOrEqual(1);

    await page.setViewportSize({ width: 900, height: 700 });

    await page.waitForFunction(
      () => {
        const canvasEl = document.querySelector<HTMLCanvasElement>(
          "[data-testid='map-container'] canvas",
        );
        const mapContainer = document.querySelector<HTMLElement>("[data-testid='map-container']");
        if (!canvasEl || !mapContainer) return false;
        const canvasRect = canvasEl.getBoundingClientRect();
        const containerRect = mapContainer.getBoundingClientRect();
        return (
          Math.abs(canvasRect.width - containerRect.width) <= 1 &&
          Math.abs(canvasRect.height - containerRect.height) <= 1
        );
      },
      { timeout: 30000 },
    );
  });
});
