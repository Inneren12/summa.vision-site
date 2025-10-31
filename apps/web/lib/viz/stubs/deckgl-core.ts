// Минимальная заглушка для @deck.gl/core
export interface DeckProps {
  layers?: unknown[];
  viewState?: unknown;
  controller?: unknown;
  parent?: HTMLElement;
  [key: string]: unknown;
}

function throwMissingLibrary(): never {
  throw new Error(
    "[viz-stub] @deck.gl/core не установлен. Установите пакет, чтобы использовать DeckGL-адаптер.",
  );
}

export class Deck {
  constructor(_props: DeckProps) {
    void _props;
    throwMissingLibrary();
  }
  setProps(_props: DeckProps): void {
    void _props;
    throwMissingLibrary();
  }
  finalize(): void {
    throwMissingLibrary();
  }
}

export default Deck;
