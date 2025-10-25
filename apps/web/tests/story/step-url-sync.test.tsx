import { render, screen, waitFor } from "@testing-library/react";
import React, { useEffect, useState } from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";

import {
  parseStepFromHash,
  parseStepFromLocation,
  parseStepFromSearch,
  scrollStepIntoView,
  useStepUrlSync,
} from "@/components/story/step-url";

describe("step URL parsing", () => {
  it("extracts id from step hash", () => {
    expect(parseStepFromHash("#step-3")).toBe("3");
    expect(parseStepFromHash("step-intro")).toBe("intro");
  });

  it("ignores unrelated hashes", () => {
    expect(parseStepFromHash("#other")).toBeNull();
  });

  it("reads id from query string", () => {
    expect(parseStepFromSearch("?step=impact")).toBe("impact");
    expect(parseStepFromSearch("?foo=bar&step=intro%20two")).toBe("intro two");
  });

  it("prefers hash over query when both present", () => {
    const locationLike = { hash: "#step-scale", search: "?step=baseline" };
    expect(parseStepFromLocation(locationLike).stepId).toBe("scale");
    expect(parseStepFromLocation(locationLike).source).toBe("hash");
  });
});

describe("useStepUrlSync", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/story");
    document.body.innerHTML =
      '<main><section id="step-baseline"></section><section id="step-impact"></section><section id="step-scale"></section></main>';
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  it("sets initial step from hash", async () => {
    window.history.replaceState({}, "", "/story#step-impact");
    function TestComponent() {
      const [active, setActive] = useState<string | null>(null);
      useStepUrlSync({ activeStepId: active, onStepFromUrl: setActive });
      return <div data-testid="active">{active ?? ""}</div>;
    }
    render(<TestComponent />);
    await waitFor(() => {
      expect(screen.getByTestId("active").textContent).toBe("impact");
    });
  });

  it("updates hash when step changes", async () => {
    function TestComponent() {
      const [active, setActive] = useState<string | null>("baseline");
      useStepUrlSync({ activeStepId: active, throttleMs: 0 });
      useEffect(() => {
        setActive("impact");
      }, []);
      return null;
    }
    render(<TestComponent />);
    await waitFor(() => {
      expect(window.location.hash).toBe("#step-impact");
    });
  });

  it("scrolls section into view when navigating from URL", async () => {
    const spy = vi.spyOn(window.HTMLElement.prototype, "scrollIntoView");
    window.history.replaceState({}, "", "/story#step-scale");
    function TestComponent() {
      const [active, setActive] = useState<string | null>(null);
      useStepUrlSync({ activeStepId: active, onStepFromUrl: setActive });
      return null;
    }
    render(<TestComponent />);
    await waitFor(() => {
      expect(spy).toHaveBeenCalled();
    });
  });

  it("provides helper to scroll programmatically", () => {
    expect(() => scrollStepIntoView("baseline")).not.toThrow();
  });
});
