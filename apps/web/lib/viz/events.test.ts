import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../analytics/send", () => ({
  sendAnalyticsEvent: vi.fn(),
}));

vi.mock("../analytics/events", () => ({
  NECESSARY_VIZ_EVENTS: new Set(["viz_ready", "viz_error"]),
}));

import { sendAnalyticsEvent } from "../analytics/send";

import { sendVizEvent } from "./events";

describe("sendVizEvent", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to sendAnalyticsEvent with derived necessity", () => {
    const detail = { lib: "fake", motion: "animated" as const };
    sendVizEvent("viz_ready", detail);

    expect(sendAnalyticsEvent).toHaveBeenCalledWith({
      name: "viz_ready",
      detail,
      isNecessary: true,
    });
  });

  it("treats unknown events as non-necessary", () => {
    const detail = { lib: "fake", motion: "discrete" as const };
    sendVizEvent("viz_lazy_mount", detail);

    expect(sendAnalyticsEvent).toHaveBeenCalledWith({
      name: "viz_lazy_mount",
      detail,
      isNecessary: false,
    });
  });

  it("respects explicit necessary override", () => {
    const detail = { lib: "fake", motion: "animated" as const };
    sendVizEvent("viz_prefetch", detail, { necessary: true });

    expect(sendAnalyticsEvent).toHaveBeenCalledWith({
      name: "viz_prefetch",
      detail,
      isNecessary: true,
    });
  });
});
