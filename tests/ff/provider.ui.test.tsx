/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect } from "vitest";

import FlagsProvider from "../../components/FlagsProvider";
import FlagGateClient from "../../components/gates/FlagGate.client";
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
    render(
      <FlagsProvider serverFlags={serverFlags}>
        <FlagGateClient name="betaUI">
          <div data-testid="beta">BETA</div>
        </FlagGateClient>
        <PercentGateClient name="newCheckout">
          <div data-testid="rollout">ROLLOUT</div>
        </PercentGateClient>
      </FlagsProvider>,
    );
    expect(screen.queryByTestId("beta")).not.toBeNull();
    expect(screen.queryByTestId("rollout")).not.toBeNull();
  });
});
