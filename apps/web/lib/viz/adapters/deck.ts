import { emitVizEvent } from "../../analytics/send";
import type { DeckSpec } from "../spec-types";
import type { MotionMode, VizAdapter } from "../types";
import { renderWebglFallback, supportsWebGL, supportsWebGL2 } from "../webgl";

type DeckProps = import("@deck.gl/core").DeckProps;
type MapboxOverlayProps = import("@deck.gl/mapbox").MapboxOverlayProps;

type DeckLike = {
  setProps?: (props: DeckProps | Partial<DeckProps>) => void;
  finalize?: () => void;
};

type MapboxOverlayLike = {
  setProps?: (props: MapboxOverlayProps | Partial<MapboxOverlayProps>) => void;
  finalize?: () => void;
};

interface MapControlLike {
  onAdd(map: MapLike): HTMLElement | void;
  onRemove(): void;
}

interface MapLike {
  addControl(control: MapControlLike, position?: string): void;
  removeControl(control: MapControlLike): void;
}

interface Instance {
  deck: DeckLike | null;
  overlay: MapboxOverlayLike | null;
  map: MapLike | null;
  spec: DeckSpec | null;
  discrete: boolean;
  cleanup: Array<() => void>;
}

function toMotion(discrete: boolean): MotionMode {
  return discrete ? "discrete" : "animated";
}

function cloneViewState(viewState: DeckSpec["viewState"]): DeckSpec["viewState"] {
  if (Array.isArray(viewState)) {
    return viewState.map((entry) => {
      if (entry && typeof entry === "object") {
        return { ...(entry as Record<string, unknown>) };
      }
      return entry;
    }) as DeckSpec["viewState"];
  }

  if (viewState && typeof viewState === "object") {
    return { ...(viewState as Record<string, unknown>) } as DeckSpec["viewState"];
  }

  return viewState;
}

function cloneSpec(spec: DeckSpec): DeckSpec {
  const { map, glOptions, layers, viewState, ...rest } = spec;
  return {
    ...(rest as DeckSpec),
    layers: Array.isArray(layers) ? layers.slice() : [],
    ...(glOptions && typeof glOptions === "object"
      ? {
          glOptions: {
            ...(glOptions as Record<string, unknown>),
          } as DeckSpec["glOptions"],
        }
      : {}),
    ...(viewState ? { viewState: cloneViewState(viewState) } : {}),
    ...(map ? { map: { ...map } } : {}),
  };
}

function disableTransitions(value: DeckProps["viewState"]): DeckProps["viewState"] {
  if (!value) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => disableTransitions(entry)) as DeckProps["viewState"];
  }

  if (typeof value === "object") {
    const next: Record<string, unknown> = { ...(value as Record<string, unknown>) };
    next.transitionDuration = 0;
    delete next.transitionEasing;
    delete next.transitionInterpolator;
    delete next.transitionOptions;
    return next as DeckProps["viewState"];
  }

  return value;
}

function sanitizeDeckProps(
  spec: DeckSpec,
  options: { discrete: boolean; overlay: boolean },
): DeckProps {
  const props: DeckProps = {
    ...(spec as DeckProps),
  };
  delete (props as { map?: unknown }).map;

  const baseGlOptions: Record<string, unknown> = {
    powerPreference: "high-performance",
    failIfMajorPerformanceCaveat: true,
    antialias: true,
    ...((props.glOptions as Record<string, unknown> | undefined) ?? {}),
  };

  if (!supportsWebGL2()) {
    baseGlOptions.preserveDrawingBuffer = baseGlOptions.preserveDrawingBuffer ?? false;
  }

  props.glOptions = baseGlOptions as DeckProps["glOptions"];

  if (options.discrete) {
    if (typeof props.transitions !== "undefined") {
      props.transitions = {} as DeckProps["transitions"];
    }
    props.viewState = disableTransitions(props.viewState);
  }

  if (options.overlay) {
    props.viewState = undefined;
    if (typeof props.controller === "undefined") {
      props.controller = false;
    }
    delete (props as { parent?: unknown }).parent;
    delete (props as { canvas?: unknown }).canvas;
  }

  return props;
}

async function mountDeck(
  el: HTMLDivElement,
  spec: DeckSpec,
  opts: { discrete: boolean },
): Promise<Instance> {
  if (!supportsWebGL()) {
    const clone = cloneSpec(spec);
    const cleanup = renderWebglFallback(el, {
      lib: "deck",
      title: "Режим совместимости",
      message: "Интерактивная 3D-визуализация недоступна без WebGL.",
      note: "Показан статичный режим без интерактивных слоёв.",
    });
    emitVizEvent("viz_fallback_engaged", {
      lib: "deck",
      motion: toMotion(opts.discrete),
      reason: "webgl",
      fallback: "static",
    });
    return {
      deck: null,
      overlay: null,
      map: null,
      spec: clone,
      discrete: opts.discrete,
      cleanup: cleanup ? [cleanup] : [],
    };
  }

  const clone = cloneSpec(spec);
  const mapCandidate = clone.map?.map as MapLike | undefined;
  const supportsOverlay =
    mapCandidate &&
    typeof mapCandidate.addControl === "function" &&
    typeof mapCandidate.removeControl === "function";

  if (supportsOverlay) {
    const { MapboxOverlay } = await import("@deck.gl/mapbox");
    const overlayProps = sanitizeDeckProps(clone, { discrete: opts.discrete, overlay: true });
    const overlay = new MapboxOverlay({
      interleaved: clone.map?.interleaved ?? true,
      ...overlayProps,
    });
    const cleanup: Array<() => void> = [];

    try {
      mapCandidate.addControl(overlay as MapControlLike, clone.map?.position);
      cleanup.push(() => {
        mapCandidate.removeControl(overlay as MapControlLike);
      });
    } catch (error) {
      emitVizEvent("viz_error", {
        lib: "deck",
        motion: toMotion(opts.discrete),
        reason: "mount",
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return {
      deck: null,
      overlay: overlay as MapboxOverlayLike,
      map: mapCandidate,
      spec: clone,
      discrete: opts.discrete,
      cleanup,
    };
  }

  const { Deck } = await import("@deck.gl/core");
  const deckProps = sanitizeDeckProps(clone, { discrete: opts.discrete, overlay: false });
  const deck = new Deck({
    ...deckProps,
    parent: el,
  });

  return {
    deck: deck as DeckLike,
    overlay: null,
    map: null,
    spec: clone,
    discrete: opts.discrete,
    cleanup: [],
  };
}

export const deckAdapter: VizAdapter<Instance, DeckSpec> = {
  async mount(el, spec, opts) {
    return mountDeck(el as HTMLDivElement, spec, opts);
  },
  applyState(instance, next, opts) {
    const currentSpec = instance.spec;
    if (!currentSpec) {
      return;
    }

    const previous = cloneSpec(currentSpec);
    const resolved = typeof next === "function" ? next(previous) : next;
    const clone = cloneSpec(resolved);
    instance.spec = clone;
    instance.discrete = opts.discrete;

    const wantsOverlay = Boolean(instance.overlay);
    const deckProps = sanitizeDeckProps(clone, {
      discrete: opts.discrete,
      overlay: wantsOverlay,
    });

    if (instance.overlay) {
      instance.overlay.setProps?.(deckProps as MapboxOverlayProps);
      return;
    }

    if (instance.deck) {
      instance.deck.setProps?.(deckProps);
    }
  },
  destroy(instance) {
    while (instance.cleanup.length > 0) {
      const cleanup = instance.cleanup.pop();
      try {
        cleanup?.();
      } catch {
        // ignore cleanup errors
      }
    }

    try {
      instance.overlay?.finalize?.();
    } catch {
      // ignore finalize errors
    }

    try {
      instance.deck?.finalize?.();
    } catch {
      // ignore finalize errors
    }

    instance.deck = null;
    instance.overlay = null;
    instance.map = null;
    instance.spec = null;
    instance.discrete = false;
  },
};

export default deckAdapter;
