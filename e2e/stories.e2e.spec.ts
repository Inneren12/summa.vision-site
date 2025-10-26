import { expect, test, type Page } from "@playwright/test";

const STORY_URL = "/story";

async function waitForChartReady(page: Page) {
  await expect
    .poll(async () => page.evaluate(() => window.__fakeChart?.state?.ready ?? false))
    .toBe(true);
}

test.describe("story scrollytelling", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(STORY_URL);
    await waitForChartReady(page);
  });

  test("updates chart state when each step enters the viewport", async ({ page }) => {
    const steps = page.locator(".story-step-anchor");
    const stepIds = await steps.evaluateAll((elements) =>
      elements
        .map((element) => element.getAttribute("data-step-id"))
        .filter((value): value is string => Boolean(value)),
    );

    for (const stepId of stepIds) {
      await page.evaluate((id) => {
        document
          .querySelector<HTMLElement>(`.story-step-anchor[data-step-id="${id}"]`)
          ?.scrollIntoView({ block: "center", behavior: "instant" });
      }, stepId);

      await expect
        .poll(() => page.evaluate(() => window.__fakeChart?.state?.activeStepId ?? null))
        .toBe(stepId);
      await expect(page.getByTestId("fake-chart")).toHaveAttribute("data-active-step", stepId);
      await expect(page.locator(`button[data-step-id="${stepId}"]`)).toHaveAttribute(
        "aria-current",
        "step",
      );
    }

    const history = await page.evaluate(() => window.__fakeChart?.state?.history ?? []);
    expect(history).toEqual(stepIds);
  });

  test("activates the final step after fast scrolling to the end", async ({ page }) => {
    const steps = page.locator(".story-step-anchor");
    const lastStepId = await steps
      .last()
      .evaluate((element) => element.getAttribute("data-step-id") ?? "");

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    await expect
      .poll(() => page.evaluate(() => window.__fakeChart?.state?.activeStepId ?? null))
      .toBe(lastStepId);
    await expect(page.getByTestId("fake-chart")).toHaveAttribute("data-active-step", lastStepId);
    await expect(page.locator(`button[data-step-id="${lastStepId}"]`)).toHaveAttribute(
      "aria-current",
      "step",
    );
  });

  test("restores step selection from URL hash and refresh", async ({ page }) => {
    const targetStepId = "scale";
    const hashId = `step-${targetStepId}`;

    await page.goto(`${STORY_URL}#${hashId}`);
    await waitForChartReady(page);

    await expect
      .poll(() => page.evaluate(() => window.__fakeChart?.state?.activeStepId ?? null))
      .toBe(targetStepId);
    await expect(page.getByTestId("fake-chart")).toHaveAttribute("data-active-step", targetStepId);
    await expect(page.locator(`.story-step-anchor[data-step-id="${targetStepId}"]`)).toBeFocused();
    await expect(page.locator(`button[data-step-id="${targetStepId}"]`)).toHaveAttribute(
      "aria-current",
      "step",
    );

    await page.reload();
    await waitForChartReady(page);

    await expect
      .poll(() => page.evaluate(() => window.__fakeChart?.state?.activeStepId ?? null))
      .toBe(targetStepId);
    await expect(page.getByTestId("fake-chart")).toHaveAttribute("data-active-step", targetStepId);
    await expect(page.locator(`.story-step-anchor[data-step-id="${targetStepId}"]`)).toBeFocused();
  });

  test("supports keyboard navigation across steps", async ({ page }) => {
    const steps = page.locator(".story-step-anchor");
    const stepIds = await steps.evaluateAll((elements) =>
      elements
        .map((element) => element.getAttribute("data-step-id"))
        .filter((value): value is string => Boolean(value)),
    );

    const [firstStepId, secondStepId, thirdStepId, lastStepId] = [
      stepIds[0],
      stepIds[1],
      stepIds[2],
      stepIds[stepIds.length - 1],
    ];

    await steps.first().focus();
    await expect(steps.first()).toBeFocused();
    await expect(page.getByTestId("fake-chart")).toHaveAttribute("data-active-step", firstStepId);

    await page.keyboard.press("ArrowDown");
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.scrollIntoView({ block: "center", behavior: "instant" });
      }
    });
    await expect
      .poll(() => page.evaluate(() => window.__fakeChart?.state?.activeStepId ?? null))
      .toBe(secondStepId);
    await expect(page.getByTestId("fake-chart")).toHaveAttribute("data-active-step", secondStepId);
    await expect(steps.nth(1)).toBeFocused();

    await page.keyboard.press("PageDown");
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.scrollIntoView({ block: "center", behavior: "instant" });
      }
    });
    await expect
      .poll(() => page.evaluate(() => window.__fakeChart?.state?.activeStepId ?? null))
      .toBe(thirdStepId);
    await expect(page.getByTestId("fake-chart")).toHaveAttribute("data-active-step", thirdStepId);
    await expect(steps.nth(2)).toBeFocused();

    await page.keyboard.press("ArrowUp");
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.scrollIntoView({ block: "center", behavior: "instant" });
      }
    });
    await expect
      .poll(() => page.evaluate(() => window.__fakeChart?.state?.activeStepId ?? null))
      .toBe(secondStepId);
    await expect(page.getByTestId("fake-chart")).toHaveAttribute("data-active-step", secondStepId);
    await expect(steps.nth(1)).toBeFocused();

    await page.keyboard.press("End");
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.scrollIntoView({ block: "center", behavior: "instant" });
      }
    });
    await expect
      .poll(() => page.evaluate(() => window.__fakeChart?.state?.activeStepId ?? null))
      .toBe(lastStepId);
    await expect(page.getByTestId("fake-chart")).toHaveAttribute("data-active-step", lastStepId);
    await expect(steps.last()).toBeFocused();

    await page.keyboard.press("Home");
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.scrollIntoView({ block: "center", behavior: "instant" });
      }
    });
    await expect
      .poll(() => page.evaluate(() => window.__fakeChart?.state?.activeStepId ?? null))
      .toBe(firstStepId);
    await expect(page.getByTestId("fake-chart")).toHaveAttribute("data-active-step", firstStepId);
    await expect(steps.first()).toBeFocused();
  });

  test("allows interactive visualizations to handle navigation keys", async ({ page }) => {
    const steps = page.locator(".story-step-anchor");
    await steps.first().focus();
    await expect(steps.first()).toBeFocused();

    const initialStepId = await page.evaluate(
      () => window.__fakeChart?.state?.activeStepId ?? null,
    );

    const chart = page.getByTestId("fake-chart");
    await chart.focus();
    await expect(chart).toBeFocused();

    await page.keyboard.press("ArrowDown");

    await expect(chart).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => window.__fakeChart?.state?.activeStepId ?? null))
      .toBe(initialStepId);

    if (initialStepId) {
      await expect(page.locator(`button[data-step-id="${initialStepId}"]`)).toHaveAttribute(
        "aria-current",
        "step",
      );
    }
  });

  test("disables transition animations when reduced motion is preferred", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await waitForChartReady(page);

    const step = page.locator(".story-step-anchor").first();
    const reduceMotionStyles = await step.evaluate((element) => {
      const styles = getComputedStyle(element);
      return {
        duration: styles.transitionDuration.split(",").map((value) => value.trim()),
        property: styles.transitionProperty.split(",").map((value) => value.trim()),
      };
    });

    expect(reduceMotionStyles.duration.length).toBeGreaterThan(0);
    expect(reduceMotionStyles.property.every((value) => value === "none")).toBeTruthy();
    const durationsAreZero = reduceMotionStyles.duration.every(
      (value) => value === "0s" || value === "0ms",
    );
    expect(
      durationsAreZero || reduceMotionStyles.property.every((value) => value === "none"),
    ).toBeTruthy();
  });
});

declare global {
  interface Window {
    __fakeChart?: {
      state: {
        activeStepId: string | null;
        history: Array<string | null>;
        ready: boolean;
      };
    };
  }
}
