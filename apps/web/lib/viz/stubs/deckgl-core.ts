// Минимальная заглушка для @deck.gl/core
export type DeckProps = Record<string, unknown>;
export class Deck {
  constructor(..._args: unknown[]) {
    void _args;
    throw new Error(
      "[viz-stub] @deck.gl/core не установлен. Установите пакет, чтобы использовать DeckGL-адаптер.",
    );
  }
}
export const _stub = true;
