import { describe, expect, it, vi } from "vitest";

import type { VegaLiteSpec } from "../spec-types";

const finalizeMock = vi.fn();

const embedMock = vi.fn(async (element: unknown, spec: unknown) => {
  const target = element as HTMLElement;
  const mark = (spec as { mark?: unknown }).mark ?? "";
  target.textContent = String(mark);
  target.dataset.rendered = JSON.stringify(spec);
  return { view: { finalize: finalizeMock } };
});

vi.mock("vega-embed", () => ({
  default: embedMock,
}));

// vitest hoists vi.mock, so import after mock definition
// eslint-disable-next-line import/first
import { vegaLiteAdapter } from "./vegaLite";

describe("vega-lite adapter dom integration", () => {
  it("updates DOM when spec changes", async () => {
    const element = document.createElement("div");
    document.body.append(element);

    const spec: VegaLiteSpec = {
      mark: "bar",
      data: { values: [{ category: "one", value: 1 }] },
    };

    const instance = await vegaLiteAdapter.mount(element, spec, { discrete: false });

    expect(embedMock).toHaveBeenCalledTimes(1);
    expect(element.textContent).toBe("bar");

    const nextSpec: VegaLiteSpec = {
      ...spec,
      mark: "line",
      data: { values: [{ category: "one", value: 2 }] },
    };

    vegaLiteAdapter.applyState(instance, nextSpec, { discrete: false });

    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(embedMock).toHaveBeenCalledTimes(2);
    expect(element.textContent).toBe("line");

    vegaLiteAdapter.destroy(instance);
    expect(finalizeMock).toHaveBeenCalled();
    expect(element.childNodes.length).toBe(0);

    element.remove();
  });
});
