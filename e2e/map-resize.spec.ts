import { expect, test } from "@playwright/test";

const CONTAINER_SELECTOR = "[data-testid='map-container']";

test.describe("Map resize", () => {
  test("canvas follows container after viewport changes", async ({ page }) => {
    await page.goto("/atoms");

    const container = page.locator(CONTAINER_SELECTOR);
    await container.scrollIntoViewIfNeeded();
    await expect(container).toBeVisible();
    await page.waitForLoadState("networkidle");

    const canvas = container
      .locator("canvas.maplibregl-canvas, canvas.mapboxgl-canvas, canvas")
      .first();

    await page.evaluate(async () => {
      window.dispatchEvent(new Event("resize"));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await expect(canvas).toBeAttached({ timeout: 30000 });
    await expect(canvas).toBeVisible();

    await page.waitForFunction(
      (selector: string) => {
        const canvasEl = document.querySelector<HTMLCanvasElement>(`${selector} canvas`);
        if (!canvasEl) return false;
        const rect = canvasEl.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      },
      CONTAINER_SELECTOR,
      { timeout: 30000 },
    );

    const initialViewport = page.viewportSize() ?? { width: 1280, height: 720 };
    await page.setViewportSize({ width: initialViewport.height, height: initialViewport.width });

    await page.waitForFunction(
      (selector: string) => {
        const root = document.querySelector<HTMLElement>(selector);
        const canvasEl = root?.querySelector<HTMLCanvasElement>("canvas");
        if (!root || !canvasEl) return false;
        const canvasRect = canvasEl.getBoundingClientRect();
        const containerRect = root.getBoundingClientRect();
        return (
          containerRect.width > 0 &&
          containerRect.height > 0 &&
          Math.abs(canvasRect.width - containerRect.width) <= 1 &&
          Math.abs(canvasRect.height - containerRect.height) <= 1
        );
      },
      CONTAINER_SELECTOR,
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
  });
});
