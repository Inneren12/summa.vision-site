import { axe, toHaveNoViolations } from "jest-axe";
import React from "react";
import { describe, expect, it } from "vitest";

import type { VisxRenderer, VisxSpec } from "../spec-types";

import { visxAdapter } from "./visx";

expect.extend(toHaveNoViolations);

const TestChart: VisxRenderer<{ readonly label: string }> = ({
  label,
  width = 200,
  height = 150,
  accessibility,
}) => {
  return (
    <svg
      role="img"
      aria-labelledby={`${accessibility.titleId} ${accessibility.descriptionId}`}
      width={width}
      height={height}
    >
      <title id={accessibility.titleId}>{accessibility.title ?? "Example chart"}</title>
      <desc id={accessibility.descriptionId}>
        {accessibility.description ?? "Renders a demonstration glyph."}
      </desc>
      <g>
        <text x={width / 2} y={height / 2} textAnchor="middle">
          {label}
        </text>
      </g>
    </svg>
  );
};

describe("visxAdapter", () => {
  it("provides a detached snapshot to the updater", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const spec: VisxSpec<{ readonly label: string }> = {
      component: TestChart,
      props: { label: "Initial" },
      title: "Initial chart",
      description: "Shows initial data",
    };

    const instance = visxAdapter.mount(container, spec, { discrete: true });

    let capturedPrev: Readonly<VisxSpec<{ readonly label: string }>> | null = null;
    const initialSpec = instance.spec;

    visxAdapter.applyState(
      instance,
      (prev) => {
        capturedPrev = prev;
        expect(prev).not.toBe(initialSpec);
        expect(prev.props).toBeDefined();
        if (prev.props) {
          (prev.props as { label: string }).label = "mutated";
        }
        return {
          ...spec,
          props: { label: "Updated" },
        } satisfies VisxSpec<{ readonly label: string }>;
      },
      { discrete: true },
    );

    expect(initialSpec.props?.label).toBe("Initial");
    expect(capturedPrev?.props?.label).toBe("mutated");
    expect(container.textContent).toContain("Updated");

    visxAdapter.destroy(instance);
    container.remove();
  });

  it("produces an accessible SVG scene", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const spec: VisxSpec<{ readonly label: string }> = {
      component: TestChart,
      props: { label: "Accessible" },
      title: "Accessible demo",
      description: "Confirms the SVG passes automated accessibility checks.",
    };

    const instance = visxAdapter.mount(container, spec, { discrete: true });

    const results = await axe(container);
    expect(results).toHaveNoViolations();

    visxAdapter.destroy(instance);
    container.remove();
  });
});
