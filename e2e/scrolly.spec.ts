import {
  hashChange,
  impression,
  resetEventClock,
  restore,
  scroll as scrollEvent,
  stepChange,
} from "../apps/web/test/fixtures/ingest";

import { acceptKlaroConsent } from "./support/consent";
import { expect, test } from "./support/msw";


const STORY_URL = "/story?slug=demo";

async function waitForChartReady(page: Parameters<typeof acceptKlaroConsent>[0]) {
  const chart = page.locator("[data-testid='fake-chart']");
  await expect(chart).toBeVisible();
  await expect.poll(async () => (await chart.getAttribute("data-ready")) === "true").toBe(true);
}

test.describe("scrollytelling flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(STORY_URL);
    await acceptKlaroConsent(page);
    await waitForChartReady(page);
  });

  test("keeps active step in sync across scroll, keyboard, and hash", async ({ page }) => {
    const steps = page.locator(".story-step-anchor");
    const stepIds = await steps.evaluateAll((elements) =>
      elements
        .map((el) => el.getAttribute("data-step-id"))
        .filter((id): id is string => typeof id === "string"),
    );

    expect(stepIds.length).toBeGreaterThan(2);

    for (const id of stepIds) {
      await page.locator(`.story-step-anchor[data-step-id='${id}']`).scrollIntoViewIfNeeded();
      await expect
        .poll(() => page.getAttribute("[data-testid='fake-chart']", "data-active-step"))
        .toBe(id);
      await expect(page.locator(`button[data-step-id='${id}']`)).toHaveAttribute(
        "aria-current",
        "step",
      );
    }

    const target = stepIds[1];
    await page.locator(`.story-step-anchor[data-step-id='${target}']`).focus();
    await page.keyboard.press("End");
    const lastId = stepIds[stepIds.length - 1];
    await expect(page.locator(`.story-step-anchor[data-step-id='${lastId}']`)).toBeFocused();
    await expect
      .poll(() => page.getAttribute("[data-testid='fake-chart']", "data-active-step"))
      .toBe(lastId);

    await page.evaluate((hashPrefix) => {
      window.location.hash = `${hashPrefix}${"baseline"}`;
    }, "step-");
    await page.waitForTimeout(50);
    await expect
      .poll(() => page.getAttribute("[data-testid='fake-chart']", "data-active-step"))
      .toBe("baseline");

    await page.reload();
    await waitForChartReady(page);
    await expect
      .poll(() => page.getAttribute("[data-testid='fake-chart']", "data-active-step"))
      .toBe("baseline");
  });

  test("posts deterministic analytics events", async ({ page }) => {
    resetEventClock();
    const payload = {
      snapshot: "snapshot-demo",
      events: [
        impression("baseline"),
        scrollEvent(0.45, { stepId: "activation" }),
        stepChange("activation"),
        hashChange("step-activation"),
        restore("activation"),
      ],
    };

    const response = await page.evaluate(async (body) => {
      const result = await fetch("/api/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      return { status: result.status, json: await result.json() };
    }, payload);

    expect(response.status).toBe(200);
    expect(response.json).toMatchObject({
      ok: true,
      requestId: expect.stringMatching(/^request-/),
      snapshot: "snapshot-demo",
      events: expect.arrayContaining([
        expect.objectContaining({ type: "impression", stepId: "baseline", slug: "demo" }),
        expect.objectContaining({ type: "scroll", stepId: "activation", slug: "demo" }),
        expect.objectContaining({ type: "step", stepId: "activation", slug: "demo" }),
        expect.objectContaining({ type: "hash", stepId: null, slug: "demo" }),
        expect.objectContaining({ type: "restore", stepId: "activation", slug: "demo" }),
      ]),
    });
  });
});
