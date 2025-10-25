/* @vitest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import FlagsProvider from "../../components/FlagsProvider";
import FlagGate from "../../components/gates/FlagGate";
import PercentGateClient from "../../components/gates/PercentGate.client";
import type { EffectiveFlags } from "../../lib/ff/flags";

describe("FlagsProvider + client gates", () => {
  it("renders consistently (SSR->CSR) using provided effective flags", () => {
    const serverFlags: EffectiveFlags = {
      newCheckout: true, // rollout -> already resolved
      betaUI: true,
      bannerText: "Hello",
      maxItems: 5,
    };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <FlagsProvider serverFlags={serverFlags}>
        <FlagGate name="betaUI" ssr={{ shouldRender: true }}>
          <div data-testid="beta">BETA</div>
        </FlagGate>
        <PercentGateClient name="newCheckout">
          <div data-testid="rollout">ROLLOUT</div>
        </PercentGateClient>
      </FlagsProvider>,
    );
    expect(screen.queryByTestId("beta")).not.toBeNull();
    expect(screen.queryByTestId("rollout")).not.toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("emits hydration mismatch warning when CSR diverges", async () => {
    const serverFlags: EffectiveFlags = {
      newCheckout: true,
      betaUI: false,
      bannerText: "Hello",
      maxItems: 5,
    };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <FlagsProvider serverFlags={serverFlags}>
        <FlagGate
          name="betaUI"
          ssr={{ shouldRender: true }}
          fallback={<div data-testid="fallback" />}
        >
          <div data-testid="beta">BETA</div>
        </FlagGate>
      </FlagsProvider>,
    );
    await waitFor(() => {
      expect(screen.queryByTestId("fallback")).not.toBeNull();
      expect(warnSpy).toHaveBeenCalled();
    });
    warnSpy.mockRestore();
  });

  it("shows skeleton until hydration when no SSR snapshot provided", async () => {
    const serverFlags: EffectiveFlags = {
      newCheckout: true,
      betaUI: true,
      bannerText: "Hello",
      maxItems: 5,
    };
    render(
      <FlagsProvider serverFlags={serverFlags}>
        <FlagGate name="betaUI" skeleton={<div data-testid="skeleton">loading</div>}>
          <div data-testid="beta">BETA</div>
        </FlagGate>
      </FlagsProvider>,
    );
    expect(screen.queryByTestId("skeleton")).not.toBeNull();
    await waitFor(() => {
      expect(screen.queryByTestId("skeleton")).toBeNull();
      expect(screen.queryByTestId("beta")).not.toBeNull();
    });
  });
});
