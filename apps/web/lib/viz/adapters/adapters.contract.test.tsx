import React from "react";
import { describe, expect, it, vi } from "vitest";

const embedMock = vi.fn(async () => ({ view: { finalize: vi.fn() } }));
vi.mock("vega-embed", () => ({
  default: embedMock,
}));

const echartsSetOption = vi.fn();
const echartsDispose = vi.fn();
const echartsInit = vi.fn(() => ({ setOption: echartsSetOption, dispose: echartsDispose }));
vi.mock("echarts", () => ({
  init: echartsInit,
}));

const mapSetStyle = vi.fn();
const mapSetCenter = vi.fn();
const mapSetZoom = vi.fn();
const mapSetPitch = vi.fn();
const mapSetBearing = vi.fn();
const mapRemove = vi.fn();
class MapMock {
  constructor(options: Record<string, unknown>) {
    this.options = options;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: Record<string, any>;
  getStyle() {
    return { sprite: this.options.style };
  }
  setStyle = mapSetStyle;
  setCenter = mapSetCenter;
  setZoom = mapSetZoom;
  setPitch = mapSetPitch;
  setBearing = mapSetBearing;
  remove = mapRemove;
}
vi.mock("maplibre-gl", () => ({
  Map: MapMock,
}));

const deckSetProps = vi.fn();
const deckFinalize = vi.fn();
class DeckMock {
  constructor(public readonly props: Record<string, unknown>) {}
  setProps = deckSetProps;
  finalize = deckFinalize;
}
vi.mock("@deck.gl/core", () => ({
  Deck: DeckMock,
}));

import { deckAdapter } from "./deck";
import { echartsAdapter } from "./echarts";
import { mapLibreAdapter } from "./maplibre";
import { vegaLiteAdapter } from "./vegaLite";
import { visxAdapter } from "./visx";

describe("viz adapters contract", () => {
  it("vega-lite adapter mounts and re-renders", async () => {
    const element = document.createElement("div");
    const spec = { mark: "bar" } as Parameters<typeof embedMock>[0];
    const instance = await vegaLiteAdapter.mount(element, spec, { discrete: false });
    expect(embedMock).toHaveBeenCalledWith(element, spec, expect.any(Object));

    const nextSpec = { mark: "line" } as Parameters<typeof embedMock>[0];
    vegaLiteAdapter.applyState(instance, nextSpec, { discrete: true });
    expect(embedMock).toHaveBeenCalledWith(element, nextSpec, expect.any(Object));

    vegaLiteAdapter.destroy(instance);
    expect(instance.result).toBeNull();
  });

  it("echarts adapter mounts and updates options", async () => {
    const element = document.createElement("div");
    const spec = { series: [] };
    const instance = await echartsAdapter.mount(element, spec, { discrete: false });
    expect(echartsInit).toHaveBeenCalledWith(element, undefined, { renderer: "canvas" });
    expect(echartsSetOption).toHaveBeenCalledWith(spec, expect.any(Object));

    const nextSpec = { series: [{ type: "line" }] };
    echartsAdapter.applyState(instance, nextSpec, { discrete: true });
    expect(echartsSetOption).toHaveBeenCalledWith(nextSpec, expect.any(Object));

    echartsAdapter.destroy(instance);
    expect(echartsDispose).toHaveBeenCalled();
  });

  it("maplibre adapter mounts and applies view state", async () => {
    const element = document.createElement("div");
    const spec = { style: "style.json", center: [0, 0], zoom: 2 };
    const instance = await mapLibreAdapter.mount(element, spec, { discrete: false });
    expect(instance.map).toBeInstanceOf(MapMock);
    mapLibreAdapter.applyState(
      instance,
      { ...spec, zoom: 4, pitch: 20, bearing: 30 },
      { discrete: true },
    );
    expect(mapSetZoom).toHaveBeenCalledWith(4);
    expect(mapSetPitch).toHaveBeenCalledWith(20, { duration: 0 });
    expect(mapSetBearing).toHaveBeenCalledWith(30, { duration: 0 });
    mapLibreAdapter.destroy(instance);
    expect(mapRemove).toHaveBeenCalled();
  });

  it("visx adapter renders react components", () => {
    const element = document.createElement("div");
    document.body.appendChild(element);

    const component = ({ label }: { label: string; discrete: boolean }) => (
      <span data-testid="label">{label}</span>
    );
    const instance = visxAdapter.mount(
      element,
      { component, props: { label: "alpha" } },
      { discrete: false },
    );

    expect(element.querySelector("[data-testid='label']")?.textContent).toBe("alpha");

    visxAdapter.applyState(instance, { component, props: { label: "beta" } }, { discrete: true });
    expect(element.querySelector("[data-testid='label']")?.textContent).toBe("beta");

    visxAdapter.destroy(instance);
    expect(element.innerHTML).toBe("");
  });

  it("deck adapter mounts and updates props", async () => {
    const element = document.createElement("div");
    const spec = { layers: [] };
    const instance = await deckAdapter.mount(element, spec, { discrete: false });
    expect(instance.deck).toBeInstanceOf(DeckMock);

    const next = { layers: [{ id: "layer" }] };
    deckAdapter.applyState(instance, next, { discrete: true });
    expect(deckSetProps).toHaveBeenCalledWith(next);

    deckAdapter.destroy(instance);
    expect(deckFinalize).toHaveBeenCalled();
  });
});
