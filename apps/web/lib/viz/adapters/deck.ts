import type { DeckProps } from "@deck.gl/core";

import type { VizAdapter } from "../types";

type DeckLike = { setProps?: (p: Partial<DeckProps>) => void; finalize?: () => void };
type Instance = { deck: DeckLike; spec: DeckProps };

async function createDeck(el: HTMLDivElement, spec: DeckProps): Promise<Instance> {
  const { Deck } = await import("@deck.gl/core");
  const deck = new Deck({ parent: el, ...spec });
  return { deck: deck as DeckLike, spec };
}

const baseAdapter: VizAdapter<Instance, DeckProps> = {
  async mount(el, spec) {
    return createDeck(el as HTMLDivElement, spec);
  },
  applyState(instance, next) {
    const props = typeof next === "function" ? next(instance.spec) : next;
    instance.spec = props;
    instance.deck.setProps?.(props);
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
