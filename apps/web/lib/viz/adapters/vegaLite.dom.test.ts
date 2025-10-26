import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { vegaLiteAdapter } from "./vegaLite";

type VegaLiteSpec = import("vega-lite").TopLevelSpec;

describe("vega-lite adapter (integration)", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("updates the rendered output when the spec changes", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const baseSpec: VegaLiteSpec = {
      data: {
        values: [
          { step: 1, label: "alpha" },
          { step: 2, label: "beta" },
        ],
      },
      mark: {
        type: "text",
        align: "left",
        baseline: "middle",
      },
      encoding: {
        x: { field: "step", type: "quantitative" },
        y: { field: "label", type: "ordinal", sort: null },
        text: { field: "label", type: "nominal" },
      },
    };

    const instance = await vegaLiteAdapter.mount(container, baseSpec, { discrete: false });

    const readLabels = () =>
      Array.from(container.querySelectorAll("svg text"))
        .map((node) => node.textContent?.trim())
        .filter((value): value is string => Boolean(value));

    await waitFor(() => {
      expect(readLabels()).toEqual(expect.arrayContaining(["alpha", "beta"]));
    });

    const nextSpec: VegaLiteSpec = {
      ...baseSpec,
      data: {
        values: [
          { step: 1, label: "gamma" },
          { step: 2, label: "delta" },
          { step: 3, label: "epsilon" },
        ],
      },
    };

    vegaLiteAdapter.applyState(instance, nextSpec, { discrete: false });

    await waitFor(() => {
      expect(readLabels()).toEqual(expect.arrayContaining(["gamma", "delta", "epsilon"]));
    });

    vegaLiteAdapter.destroy(instance);
  });
});
