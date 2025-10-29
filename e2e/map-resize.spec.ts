import { expect, test } from "@playwright/test";

const CONTAINER_SELECTOR = "[data-testid='map-container']";

test.describe("Map resize", () => {
  test("canvas follows container after viewport changes", async ({ page }) => {
    await page.goto("/atoms");

    const container = page.locator(CONTAINER_SELECTOR);
    const canvas = container.locator("canvas.maplibregl-canvas");

    await expect(container).toBeVisible();
    await canvas.waitFor({ state: "attached" });

    await page.waitForFunction((selector: string) => {
      const root = document.querySelector(selector) as HTMLElement | null;
      const canvasEl = root?.querySelector("canvas.maplibregl-canvas") as HTMLCanvasElement | null;
      if (!root || !canvasEl) return false;
      return canvasEl.width > 0 && canvasEl.height > 0;
    }, CONTAINER_SELECTOR);

    const initialViewport = page.viewportSize() ?? { width: 1280, height: 720 };
    await page.setViewportSize({ width: initialViewport.height, height: initialViewport.width });

    await page.waitForFunction((selector: string) => {
      const root = document.querySelector(selector) as HTMLElement | null;
      const canvasEl = root?.querySelector("canvas.maplibregl-canvas") as HTMLCanvasElement | null;
      if (!root || !canvasEl) return false;
      const { width, height } = root.getBoundingClientRect();
      return (
        width > 0 &&
        height > 0 &&
        Math.abs(canvasEl.width - width) <= 1 &&
        Math.abs(canvasEl.height - height) <= 1
      );
    }, CONTAINER_SELECTOR);

    const [box, canvasSize] = await Promise.all([
      container.boundingBox(),
      canvas.evaluate((node) => ({ width: node.width, height: node.height })),
    ]);

    expect(box).toBeTruthy();
    expect(canvasSize.width).toBeGreaterThan(0);
    expect(canvasSize.height).toBeGreaterThan(0);
    expect(Math.abs((box?.width ?? 0) - canvasSize.width)).toBeLessThanOrEqual(1);
    expect(Math.abs((box?.height ?? 0) - canvasSize.height)).toBeLessThanOrEqual(1);
  });
});
