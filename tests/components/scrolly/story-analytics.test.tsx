/* @vitest-environment jsdom */
import "@testing-library/jest-dom";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import Step from "../../../components/scrolly/Step";
import StickyPanel from "../../../components/scrolly/StickyPanel";
import Story from "../../../components/scrolly/Story";
import StoryShareButton from "../../../components/scrolly/StoryShareButton";
import { STEP_EXIT_DELAY_MS } from "../../../components/scrolly/useStoryAnalytics";
import {
  resetMockIntersectionObserver,
  setupMockIntersectionObserver,
  triggerIntersection,
} from "../../utils/mockIntersectionObserver";

type CapturedEvent = {
  event: string;
  storyId: string;
  stepId?: string;
};

const events: CapturedEvent[] = [];

const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn<typeof globalThis.fetch>> | null = null;

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  if (typeof Request !== "undefined" && input instanceof Request) {
    return input.url;
  }

  return String(input);
}

function getEventsByType(type: string) {
  return events.filter((event) => event.event === type);
}

async function renderStory(consent: "necessary" | "all" = "all") {
  document.cookie = `sv_consent=${consent}`;
  const result = render(
    <Story stickyTop={0} storyId="demo-story">
      <StickyPanel>
        <div>
          <StoryShareButton />
        </div>
      </StickyPanel>
      <Step id="step-1" title="Step 1">
        <p>First step body</p>
      </Step>
      <Step id="step-2" title="Step 2">
        <p>Second step body</p>
      </Step>
    </Story>,
  );

  const sentinel = result.container.querySelector(
    "[data-scrolly-lazy-sentinel]",
  ) as HTMLElement | null;
  if (sentinel) {
    await act(async () => {
      triggerIntersection(sentinel);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  return result;
}

describe("story analytics", () => {
  beforeAll(() => {
    setupMockIntersectionObserver();
  });

  beforeEach(() => {
    events.length = 0;
    document.cookie = "sv_consent=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    Object.defineProperty(navigator, "doNotTrack", { configurable: true, value: "0" });
    Object.defineProperty(window, "doNotTrack", { configurable: true, value: "0" });
    Object.defineProperty(navigator, "globalPrivacyControl", { configurable: true, value: false });

    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = getRequestUrl(input);
      if (url.endsWith("/api/dev/analytics/story")) {
        const rawBody = init?.body;
        if (rawBody) {
          try {
            const text = typeof rawBody === "string" ? rawBody : String(rawBody);
            const parsed = JSON.parse(text) as CapturedEvent;
            events.push(parsed);
          } catch {
            // ignore malformed payloads
          }
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response(null, { status: 204 });
    });

    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: fetchMock,
    });
  });

  afterEach(() => {
    document.cookie = "sv_consent=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    Reflect.deleteProperty(navigator, "doNotTrack");
    Reflect.deleteProperty(window, "doNotTrack");
    Reflect.deleteProperty(navigator, "globalPrivacyControl");
    if (originalFetch) {
      Object.defineProperty(globalThis, "fetch", {
        configurable: true,
        writable: true,
        value: originalFetch,
      });
    } else {
      Reflect.deleteProperty(globalThis, "fetch");
    }
    fetchMock?.mockReset();
    fetchMock = null;
    resetMockIntersectionObserver();
  });

  afterAll(() => {
    if (originalFetch) {
      Object.defineProperty(globalThis, "fetch", {
        configurable: true,
        writable: true,
        value: originalFetch,
      });
    } else {
      Reflect.deleteProperty(globalThis, "fetch");
    }
  });

  it("emits story and step events with deduplication and exit delay", async () => {
    await renderStory("all");

    await waitFor(() => {
      expect(getEventsByType("story_view")).toHaveLength(1);
    });

    const firstStep = screen.getByRole("article", { name: "Step 1" });
    const secondStep = screen.getByRole("article", { name: "Step 2" });

    await act(async () => {
      firstStep.focus();
    });

    await waitFor(() => {
      expect(getEventsByType("step_view").find((event) => event.stepId === "step-1")).toBeTruthy();
    });

    await act(async () => {
      secondStep.focus();
    });

    await waitFor(() => {
      expect(getEventsByType("step_view").find((event) => event.stepId === "step-2")).toBeTruthy();
    });

    expect(getEventsByType("step_exit")).toHaveLength(0);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, STEP_EXIT_DELAY_MS + 100));
    });

    await waitFor(() => {
      expect(getEventsByType("step_exit").find((event) => event.stepId === "step-1")).toBeTruthy();
    });

    await act(async () => {
      firstStep.focus();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, STEP_EXIT_DELAY_MS + 100));
    });

    await waitFor(() => {
      expect(getEventsByType("step_exit").find((event) => event.stepId === "step-2")).toBeTruthy();
    });

    expect(getEventsByType("step_view").filter((event) => event.stepId === "step-1")).toHaveLength(
      1,
    );
  });

  it("suppresses analytics when do-not-track is enabled", async () => {
    Object.defineProperty(navigator, "doNotTrack", { configurable: true, value: "1" });
    Object.defineProperty(window, "doNotTrack", { configurable: true, value: "1" });

    await renderStory("all");

    const firstStep = screen.getByRole("article", { name: "Step 1" });
    await act(async () => {
      firstStep.focus();
      await new Promise((resolve) => setTimeout(resolve, STEP_EXIT_DELAY_MS + 100));
    });

    await waitFor(() => {
      expect(events).toHaveLength(0);
    });
  });

  it("emits only necessary events when consent is limited", async () => {
    await renderStory("necessary");

    const shareButton = screen.getByRole("button", { name: "Поделиться" });
    await act(async () => {
      fireEvent.click(shareButton);
    });

    const firstStep = screen.getByRole("article", { name: "Step 1" });
    await act(async () => {
      firstStep.focus();
    });

    await waitFor(() => {
      expect(getEventsByType("story_view")).toHaveLength(1);
      expect(getEventsByType("step_view").find((event) => event.stepId === "step-1")).toBeTruthy();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, STEP_EXIT_DELAY_MS + 100));
    });

    await waitFor(() => {
      expect(getEventsByType("step_exit")).toHaveLength(0);
      expect(getEventsByType("share_click")).toHaveLength(0);
    });
  });

  it("tracks share clicks when consent allows full analytics", async () => {
    await renderStory("all");

    const shareButton = screen.getByRole("button", { name: "Поделиться" });
    await act(async () => {
      fireEvent.click(shareButton);
    });

    await waitFor(() => {
      expect(getEventsByType("share_click")).toHaveLength(1);
    });
  });
});
