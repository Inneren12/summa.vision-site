// Минимальная заглушка для vega-embed
export type VisualizationSpec = Record<string, unknown>;
export type EmbedOptions = Record<string, unknown>;
export type EmbedResult = { view: { runAsync: () => Promise<void>; finalize: () => void } };

export default async function vegaEmbed(
  _el: unknown,
  _spec: VisualizationSpec,
  _opts?: EmbedOptions,
): Promise<EmbedResult> {
  void _el;
  void _spec;
  void _opts;
  throw new Error(
    "[viz-stub] vega-embed не установлен. Установите пакет, чтобы использовать Vega/Vega-Lite адаптер.",
  );
}
