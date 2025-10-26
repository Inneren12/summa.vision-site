/* @vitest-environment jsdom */
import "@testing-library/jest-dom";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import Step from "../../../components/scrolly/Step";
import StickyPanel from "../../../components/scrolly/StickyPanel";
import Story from "../../../components/scrolly/Story";
import StoryShareButton from "../../../components/scrolly/StoryShareButton";
import { STEP_EXIT_DELAY_MS } from "../../../components/scrolly/useStoryAnalytics";

type CapturedEvent = {
  event: string;
  storyId: string;
  stepId?: string;
};

const events: CapturedEvent[] = [];

const server = setupServer(
  http.post("/api/dev/analytics/story", async ({ request }) => {
    const body = (await request.json()) as CapturedEvent;
    events.push(body);
    return HttpResponse.json({ ok: true });
  }),
);

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;

  readonly rootMargin: string = "";

  readonly thresholds: ReadonlyArray<number> = [];

  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  disconnect(): void {}

  observe(target: Element): void {
    const entry = {
      target,
      isIntersecting: true,
      intersectionRatio: 1,
      boundingClientRect: target.getBoundingClientRect(),
      intersectionRect: target.getBoundingClientRect(),
      rootBounds: null,
      time: Date.now(),
    } as IntersectionObserverEntry;

    this.callback([entry], this);
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  unobserve(): void {}
}

function getEventsByType(type: string) {
  return events.filter((event) => event.event === type);
}

function renderStory(consent: "necessary" | "all" = "all") {
  document.cookie = `sv_consent=${consent}`;
  return render(
    <Story stickyTop={0} storyId="demo-story">
      <StickyPanel>
        <div>
          <StoryShareButton />
        </div>
      </StickyPanel>
      <Step id="step-1" title="Step 1">
        <p>First step body</p>
        <StoryShareButton />
      </Step>
      <Step id="step-2" title="Step 2">
        <p>Second step body</p>
      </Step>
    </Story>,
  );
}

describe("story analytics", () => {
  beforeAll(() => {
    server.listen();
    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      writable: true,
      value: MockIntersectionObserver,
    });
  });

  beforeEach(() => {
    events.length = 0;
    document.cookie = "sv_consent=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    Object.defineProperty(navigator, "doNotTrack", { configurable: true, value: "0" });
    Object.defineProperty(window, "doNotTrack", { configurable: true, value: "0" });
    Object.defineProperty(navigator, "globalPrivacyControl", { configurable: true, value: false });
  });

  afterEach(() => {
    server.resetHandlers();
    document.cookie = "sv_consent=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    Reflect.deleteProperty(navigator, "doNotTrack");
    Reflect.deleteProperty(window, "doNotTrack");
    Reflect.deleteProperty(navigator, "globalPrivacyControl");
  });

  afterAll(() => {
    server.close();
  });

  it("emits story and step events with deduplication and exit delay", async () => {
    renderStory("all");

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

    renderStory("all");

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
    renderStory("necessary");

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const shareButton = await screen.findByRole("button", { name: "Поделиться" });
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
    renderStory("all");

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const shareButton = await screen.findByRole("button", { name: "Поделиться" });
    await act(async () => {
      fireEvent.click(shareButton);
    });

    await waitFor(() => {
      expect(getEventsByType("share_click")).toHaveLength(1);
    });
  });
});
