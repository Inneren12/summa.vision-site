/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect } from "vitest";

import FlagsProvider from "../../components/FlagsProvider";
import DevFlagsPage from "../../components/dev/DevFlagsPage";
import type { EffectiveFlags } from "../../lib/ff/flags";

describe("DevFlagsPage basic rendering and links", () => {
  it("shows override links for each known flag", () => {
    const serverFlags: EffectiveFlags = {
      newCheckout: false,
      betaUI: false,
      bannerText: "",
      maxItems: 10,
    };
    // mock document.cookie for overrides read
    Object.defineProperty(document, "cookie", { value: "", writable: true });
    render(
      <FlagsProvider serverFlags={serverFlags}>
        <DevFlagsPage />
      </FlagsProvider>,
    );
    // Expect ON/OFF/Reset controls appear for at least one flag
    expect(screen.getAllByText("ON").length).toBeGreaterThan(0);
    expect(screen.getAllByText("OFF").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Reset").length).toBeGreaterThan(0);
  });
});
