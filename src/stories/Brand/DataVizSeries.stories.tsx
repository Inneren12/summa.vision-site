import type { Meta, StoryObj } from "@storybook/react";
import React from "react";

import "./brand-stories.css";
import type { TokenMeta } from "./utils";
import { resolveToken, tokenPathToCssVar } from "./utils";

const seriesTokens: TokenMeta[] = [
  { token: "color.series.1", label: "Series 1", description: "Primary accent" },
  { token: "color.series.2", label: "Series 2" },
  { token: "color.series.3", label: "Series 3" },
  { token: "color.series.4", label: "Series 4" },
  { token: "color.series.5", label: "Series 5" },
  { token: "color.series.6", label: "Series 6" },
  { token: "color.series.7", label: "Series 7" },
  { token: "color.series.8", label: "Series 8" },
  { token: "color.series.9", label: "Series 9" },
  { token: "color.series.10", label: "Series 10" },
  { token: "color.series.11", label: "Series 11" },
  { token: "color.series.12", label: "Series 12" },
];

const gridTokens: TokenMeta[] = [
  { token: "color.grid.major", label: "Grid Major", description: "Axis baselines" },
  { token: "color.grid.minor", label: "Grid Minor", description: "Tick marks, helpers" },
];

const divergingPairs = [
  ["color.series.1", "color.series.11"],
  ["color.series.2", "color.series.10"],
  ["color.series.3", "color.series.9"],
  ["color.series.4", "color.series.8"],
] as const;

function lastSegment(token: TokenMeta["token"]): string {
  const parts = token.split(".");
  return parts[parts.length - 1];
}

const meta = {
  title: "Brand/Data Viz Series",
  component: DataVizSeriesStory,
  parameters: {
    docs: {
      description: {
        component:
          "Categorical and grid tokens for charts. Cards highlight raw token values and recommended diverging pairings.",
      },
    },
  },
} satisfies Meta<typeof DataVizSeriesStory>;

export default meta;

type Story = StoryObj<typeof meta>;

function SeriesSwatch({ spec }: { spec: TokenMeta }) {
  const value = resolveToken(spec.token);
  const cssVar = tokenPathToCssVar(spec.token);
  return (
    <article className="brand-series-item">
      <div className="brand-series-item__swatch" style={{ background: `var(${cssVar})` }} />
      <div className="brand-card__body">
        <strong>{spec.label ?? spec.token}</strong>
        {spec.description ? <p className="brand-note">{spec.description}</p> : null}
        <div className="brand-token-meta">
          <div>
            Token: <code>{spec.token}</code>
          </div>
          <div>
            CSS: <code>var({cssVar})</code>
          </div>
          <div>
            Value: <code>{value}</code>
          </div>
        </div>
      </div>
    </article>
  );
}

function DivergingPair({ tokens }: { tokens: readonly [TokenMeta["token"], TokenMeta["token"]] }) {
  const [start, end] = tokens;
  const startVar = tokenPathToCssVar(start);
  const endVar = tokenPathToCssVar(end);
  return (
    <div
      className="brand-series-item__swatch"
      style={{
        background: `linear-gradient(90deg, var(${startVar}) 0%, var(${endVar}) 100%)`,
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--color-border-subtle)",
      }}
    />
  );
}

function DataVizSeriesStory() {
  return (
    <div className="brand-story">
      <div className="brand-story__content">
        <section className="brand-section">
          <div className="brand-section__header">
            <h2 className="brand-section__title">Categorical Series</h2>
            <p className="brand-section__description">
              Use the ordered ramp for categorical charts. Do not reshuffle unless the legend is
              reset.
            </p>
          </div>
          <div className="brand-series-scale">
            {seriesTokens.map((spec) => (
              <SeriesSwatch key={spec.token} spec={spec} />
            ))}
          </div>
        </section>

        <section className="brand-section">
          <div className="brand-section__header">
            <h2 className="brand-section__title">Grid Lines</h2>
            <p className="brand-section__description">
              Grid tokens ensure sufficient contrast on both light and dark backgrounds.
            </p>
          </div>
          <div className="brand-grid brand-grid--swatches">
            {gridTokens.map((spec) => (
              <SeriesSwatch key={spec.token} spec={spec} />
            ))}
          </div>
        </section>

        <section className="brand-section">
          <div className="brand-section__header">
            <h2 className="brand-section__title">Recommended Diverging Pairs</h2>
            <p className="brand-section__description">
              Pair series tokens from opposite ends of the ramp when building diverging charts.
            </p>
          </div>
          <div className="brand-grid brand-grid--swatches">
            {divergingPairs.map((pair) => (
              <article key={pair.join("-")} className="brand-card">
                <div className="brand-card__body">
                  <strong>
                    {lastSegment(pair[0])} ↔ {lastSegment(pair[1])}
                  </strong>
                  <DivergingPair tokens={pair} />
                  <div className="brand-token-meta">
                    <div>
                      Start: <code>{pair[0]}</code>
                    </div>
                    <div>
                      End: <code>{pair[1]}</code>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export const DataVizSeries: Story = {
  name: "Data Viz Series",
  render: () => <DataVizSeriesStory />,
};
