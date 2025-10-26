import type { DeckProps } from "@deck.gl/core";

import type { VizAdapter } from "../types";

interface DeckInstance {
  deck: import("@deck.gl/core").Deck;
  spec: DeckProps;
}

export const deckAdapter: VizAdapter<DeckInstance, DeckProps> = {
  async mount(el, spec) {
    const deckModule = await import("@deck.gl/core");
    const DeckCtor = deckModule.Deck;
    const deck = new DeckCtor({ parent: el, ...spec });
    return { deck, spec };
  },
  applyState(instance, next) {
    const props = typeof next === "function" ? next(instance.spec) : next;
    instance.spec = props;
    instance.deck.setProps(props);
  },
  destroy(instance) {
    instance.deck.finalize();
  },
};
