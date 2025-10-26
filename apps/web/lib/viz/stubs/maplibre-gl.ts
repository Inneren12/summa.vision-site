// Минимальная заглушка для maplibre-gl
export class Map {
  constructor(..._args: unknown[]) {
    void _args;
    throw new Error(
      "[viz-stub] maplibre-gl не установлен. Установите пакет, чтобы использовать MapLibre-адаптер.",
    );
  }
  remove() {}
}

const maplibregl = { Map };
export default maplibregl;
