import { emitVizEvent } from "../../analytics/send";
import type { MotionMode, VizAdapter } from "../types";
import { renderWebglFallback, supportsWebGL } from "../webgl";

type DeckProps = import("@deck.gl/core").DeckProps;

type DeckLike = { setProps?: (p: Partial<DeckProps>) => void; finalize?: () => void };
type Instance = { deck: DeckLike | null; spec: DeckProps | null; cleanup: Array<() => void> };

function toMotion(discrete: boolean): MotionMode {
  return discrete ? "discrete" : "animated";
}

async function createDeck(
  el: HTMLDivElement,
  spec: DeckProps,
  opts: { discrete: boolean } = { discrete: false },
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
    return { deck: null, spec: clone, cleanup: cleanup ? [cleanup] : [] };
  }

  const { Deck } = await import("@deck.gl/core");
  const clone = cloneSpec(spec);
  const deck = new Deck({ parent: el, ...clone });
  return { deck: deck as DeckLike, spec: clone, cleanup: [] };
}

function cloneSpec(spec: DeckProps): DeckProps {
  if (typeof globalThis.structuredClone === "function") {
    try {
      return globalThis.structuredClone(spec);
    } catch {
      // ignore
    }
  }
  return { ...(spec as Record<string, unknown>) } as DeckProps;
}

const baseAdapter: VizAdapter<Instance, DeckProps> = {
  async mount(el, spec, opts) {
    return createDeck(el as HTMLDivElement, spec, opts);
  },
  applyState(instance, next) {
    const deck = instance.deck;
    const currentSpec = instance.spec;
    if (!deck || !currentSpec) {
      return;
    }
    const previous = cloneSpec(currentSpec);
    const props = typeof next === "function" ? next(previous) : next;
    const clone = cloneSpec(props);
    instance.spec = clone;
    deck.setProps?.(clone);
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
    instance.deck?.finalize?.();
    instance.deck = null;
    instance.spec = null;
  },
};

export const deckAdapter = Object.assign(baseAdapter, {
  name: "deck",
  create: (el: HTMLDivElement, spec: DeckProps, opts?: { discrete: boolean }) =>
    createDeck(el, spec, opts ?? { discrete: false }),
});

export default deckAdapter;
