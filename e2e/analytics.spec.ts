import {
  hashChange,
  impression,
  resetEventClock,
  restore,
  scroll,
  stepChange,
  viewportChange,
} from "../apps/web/test/fixtures/ingest";

import { acceptKlaroConsent } from "./support/consent";
import { expect, test } from "./support/msw";


const STORY_URL = "/story?slug=analytics";

async function ensureStoryLoaded(page: Parameters<typeof acceptKlaroConsent>[0]) {
  await page.goto(STORY_URL);
  await acceptKlaroConsent(page);
  const steps = page.locator(".story-step-anchor");
  await expect(steps.first()).toBeVisible();
}

test.describe("analytics ingestion", () => {
  test.beforeEach(async ({ page }) => {
    await ensureStoryLoaded(page);
  });

  test("aggregates story telemetry into deterministic snapshot", async ({ page }) => {
    resetEventClock();
    const payload = {
      snapshot: "snapshot-analytics",
      slug: "analytics",
      events: [
        impression("baseline", { slug: "analytics" }),
        scroll(0.18, { stepId: "tracking", slug: "analytics" }),
        viewportChange("baseline", "tracking", { slug: "analytics" }),
        stepChange("tracking", "forward", { slug: "analytics" }),
        hashChange("step-tracking", { slug: "analytics" }),
        restore("tracking", { slug: "analytics" }),
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
    const normalized = JSON.stringify(response.json, null, 2);
    expect(normalized).toMatchSnapshot("analytics-ingest.json");
  });
});
