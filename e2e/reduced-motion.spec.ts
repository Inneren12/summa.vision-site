import { acceptKlaroConsent } from "./support/consent";
import { expect, test } from "./support/msw";

const STORY_URL = "/story?slug=reduced-motion";

test.describe("reduced motion preference", () => {
  test("disables transitions and resolves chart readiness quickly", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(STORY_URL);
    await acceptKlaroConsent(page);

    const readinessDuration = await page.evaluate(async () => {
      const chart = document.querySelector("[data-testid='fake-chart']");
      if (!chart) return -1;
      const start = performance.now();
      return new Promise<number>((resolve) => {
        const check = () => {
          if (chart.getAttribute("data-ready") === "true") {
            resolve(performance.now() - start);
            return;
          }
          requestAnimationFrame(check);
        };
        check();
      });
    });

    expect(readinessDuration).toBeGreaterThanOrEqual(0);
    expect(readinessDuration).toBeLessThan(150);

    const motionStyles = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll<HTMLElement>(".story-step-anchor, [data-testid='fake-chart']"),
      ).map((element) => {
        const styles = getComputedStyle(element);
        return {
          id:
            element.getAttribute("data-step-id") ??
            element.getAttribute("data-testid") ??
            "unknown",
          transitionDuration: styles.transitionDuration,
          transitionDelay: styles.transitionDelay,
          animationDuration: styles.animationDuration,
        };
      });
    });

    for (const entry of motionStyles) {
      expect(entry.transitionDuration === "0s" || entry.transitionDuration === "0ms").toBe(true);
      expect(entry.transitionDelay === "0s" || entry.transitionDelay === "0ms").toBe(true);
      expect(entry.animationDuration === "0s" || entry.animationDuration === "0ms").toBe(true);
    }
  });
});
