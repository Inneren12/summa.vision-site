import type { VizAdapter } from "../types";

type DeckProps = import("@deck.gl/core").DeckProps;

type DeckLike = { setProps?: (p: Partial<DeckProps>) => void; finalize?: () => void };
type Instance = { deck: DeckLike; spec: DeckProps };

async function createDeck(el: HTMLDivElement, spec: DeckProps): Promise<Instance> {
  const { Deck } = await import("@deck.gl/core");
  const clone = cloneSpec(spec);
  const deck = new Deck({ parent: el, ...clone });
  return { deck: deck as DeckLike, spec: clone };
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
  async mount(el, spec) {
    return createDeck(el as HTMLDivElement, spec);
  },
  applyState(instance, next) {
    const previous = cloneSpec(instance.spec);
    const props = typeof next === "function" ? next(previous) : next;
    const clone = cloneSpec(props);
    instance.spec = clone;
    instance.deck.setProps?.(clone);
  },
  destroy(instance) {
    instance.deck.finalize?.();
  },
};

export const deckAdapter = Object.assign(baseAdapter, {
  name: "deck",
  create: createDeck,
});

export default deckAdapter;
