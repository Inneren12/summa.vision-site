/**
 * Upstream visualization libraries ship their own type definitions.
 * This file augments selected ambient typings to expose APIs that are
 * currently missing in the published packages.
 *
 * Canonical spec aliases live in {@link ../lib/viz/spec-types.ts}.
 */

declare module "vega" {
  /**
   * Listener invoked when a signal's value changes.
   */
  export type SignalListener = (name: string, value: unknown) => void;

  export interface View {
    addSignalListener(signalName: string, handler: SignalListener): this;
    removeSignalListener(signalName: string, handler: SignalListener): this;
    signal(signalName: string, value: unknown): this;
    signalNames(): string[];
    runAsync(): Promise<this>;
    finalize(): this;
  }
}

declare module "vega-lite" {
  export type TopLevelSpec = Record<string, unknown> & {
    encoding?: Record<string, unknown>;
  };
}

type VegaEmbedStub = typeof import("../lib/viz/stubs/vega-embed").default;
type VegaEmbedStubResult = Awaited<ReturnType<VegaEmbedStub>>;

declare module "vega-embed" {
  export default function vegaEmbed(
    ...args: Parameters<VegaEmbedStub>
  ): Promise<Omit<VegaEmbedStubResult, "view"> & { view?: import("vega").View }>;
}

export {};
