import type { Meta, StoryObj } from "@storybook/react";
import React from "react";

import "./brand-stories.css";
import type { TokenMeta } from "./utils";
import { resolveToken, tokenPathToCssVar } from "./utils";

type TypeSpec = {
  name: string;
  size: TokenMeta["token"];
  lineHeight: TokenMeta["token"];
  weight: TokenMeta["token"];
  sample: string;
  description: string;
  family?: TokenMeta["token"];
};

const typeScale: TypeSpec[] = [
  {
    name: "Display",
    size: "font.size.display",
    lineHeight: "font.lineHeight.tight",
    weight: "font.weight.semibold",
    sample: "Data illuminates action.",
    description: "Hero headlines and marquee statements.",
  },
  {
    name: "H1",
    size: "font.size.h1",
    lineHeight: "font.lineHeight.tight",
    weight: "font.weight.semibold",
    sample: "Open budgets, shared insight.",
    description: "Top-level page and section titles.",
  },
  {
    name: "H2",
    size: "font.size.h2",
    lineHeight: "font.lineHeight.snug",
    weight: "font.weight.semibold",
    sample: "Community metrics at a glance",
    description: "Feature callouts and summaries.",
  },
  {
    name: "H3",
    size: "font.size.h3",
    lineHeight: "font.lineHeight.snug",
    weight: "font.weight.medium",
    sample: "Ridership trend",
    description: "Card titles and inline analytics.",
  },
  {
    name: "H4",
    size: "font.size.h4",
    lineHeight: "font.lineHeight.normal",
    weight: "font.weight.medium",
    sample: "Budget allocation",
    description: "Subheadlines and key metrics.",
  },
  {
    name: "H5",
    size: "font.size.h5",
    lineHeight: "font.lineHeight.normal",
    weight: "font.weight.medium",
    sample: "Navigation label",
    description: "UI labels and navigation.",
  },
  {
    name: "Body",
    size: "font.size.body",
    lineHeight: "font.lineHeight.normal",
    weight: "font.weight.regular",
    sample: "Summa Vision translates civic open data into collective understanding.",
    description: "Long-form narrative copy.",
  },
  {
    name: "Body Small",
    size: "font.size.bodySm",
    lineHeight: "font.lineHeight.snug",
    weight: "font.weight.regular",
    sample: "Updated: 12.04.2024 09:00 GMT+3",
    description: "Supporting metadata and captions.",
  },
  {
    name: "Caption",
    size: "font.size.caption",
    lineHeight: "font.lineHeight.snug",
    weight: "font.weight.medium",
    sample: "Source: City Transit | CC-BY 4.0",
    description: "Chart axes and eyebrow labels.",
  },
  {
    name: "Mono",
    size: "font.size.bodySm",
    lineHeight: "font.lineHeight.snug",
    weight: "font.weight.medium",
    family: "font.family.mono",
    sample: "1,024 municipalities • 87 datasets",
    description: "Tabular data and inline stats.",
  },
];

const fontFamilies: TokenMeta[] = [
  {
    token: "font.family.sans",
    label: "Sans",
    description: "Primary UI and editorial typeface stack.",
  },
  { token: "font.family.mono", label: "Mono", description: "Data, code, and tabular numerals." },
];

const lineHeights: TokenMeta[] = [
  { token: "font.lineHeight.tight", label: "Tight", description: "Display, H1" },
  { token: "font.lineHeight.snug", label: "Snug", description: "H2–H3, captions, mono" },
  { token: "font.lineHeight.normal", label: "Normal", description: "H4–Body" },
  {
    token: "font.lineHeight.relaxed",
    label: "Relaxed",
    description: "Long-form narrative moments",
  },
];

const fontWeights: TokenMeta[] = [
  { token: "font.weight.regular", label: "Regular", description: "Body copy" },
  { token: "font.weight.medium", label: "Medium", description: "Headings, captions" },
  { token: "font.weight.semibold", label: "Semibold", description: "Display and hero text" },
  { token: "font.weight.bold", label: "Bold", description: "Emphasis, numeric callouts" },
];

const meta = {
  title: "Brand/Typography",
  component: TypographyStory,
  parameters: {
    docs: {
      description: {
        component:
          "Typography scale sourced directly from generated tokens. Font stacks, sizing, and rhythm demonstrate the shared system.",
      },
    },
  },
} satisfies Meta<typeof TypographyStory>;

export default meta;

type Story = StoryObj<typeof meta>;

function TypographyCard({ spec }: { spec: TypeSpec }) {
  const fontFamilyToken = spec.family ?? "font.family.sans";
  const fontSizeValue = resolveToken(spec.size);
  const lineHeightValue = resolveToken(spec.lineHeight);
  const weightValue = resolveToken(spec.weight);
  const familyValue = resolveToken(fontFamilyToken);

  return (
    <article className="brand-card">
      <div className="brand-card__body">
        <div className="brand-typography-sample">
          <span className="brand-typography-sample__label">{spec.name}</span>
          <span
            style={{
              fontFamily: `var(${tokenPathToCssVar(fontFamilyToken)})`,
              fontSize: fontSizeValue,
              lineHeight: lineHeightValue,
              fontWeight: Number(weightValue),
              fontVariantNumeric: spec.family ? "tabular-nums" : undefined,
            }}
          >
            {spec.sample}
          </span>
        </div>
        <p className="brand-note">{spec.description}</p>
        <div className="brand-token-meta">
          <div>
            Size: <code>{spec.size}</code> = <code>{fontSizeValue}</code>
          </div>
          <div>
            Line height: <code>{spec.lineHeight}</code> = <code>{lineHeightValue}</code>
          </div>
          <div>
            Weight: <code>{spec.weight}</code> = <code>{weightValue}</code>
          </div>
          <div>
            Family: <code>{fontFamilyToken}</code> = <code>{familyValue}</code>
          </div>
        </div>
      </div>
    </article>
  );
}

function TokenList({ items }: { items: TokenMeta[] }) {
  return (
    <div className="brand-grid brand-grid--typography">
      {items.map((item) => {
        const value = resolveToken(item.token);
        return (
          <article key={item.token} className="brand-card">
            <div className="brand-card__body">
              <strong>{item.label ?? item.token}</strong>
              {item.description ? <p className="brand-note">{item.description}</p> : null}
              <div className="brand-token-meta">
                <div>
                  Token: <code>{item.token}</code>
                </div>
                <div>
                  Value: <code>{value}</code>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function TypographyStory() {
  return (
    <div className="brand-story">
      <div className="brand-story__content">
        <section className="brand-section">
          <div className="brand-section__header">
            <h2 className="brand-section__title">Type Scale</h2>
            <p className="brand-section__description">
              Scale establishes rhythm between editorial storytelling and data visualizations.
            </p>
          </div>
          <div className="brand-grid brand-grid--typography">
            {typeScale.map((spec) => (
              <TypographyCard key={spec.name} spec={spec} />
            ))}
          </div>
        </section>

        <section className="brand-section">
          <div className="brand-section__header">
            <h2 className="brand-section__title">Font Families</h2>
            <p className="brand-section__description">
              Tokenized font stacks keep platform rendering consistent across locales.
            </p>
          </div>
          <TokenList items={fontFamilies} />
        </section>

        <section className="brand-section">
          <div className="brand-section__header">
            <h2 className="brand-section__title">Line Heights</h2>
            <p className="brand-section__description">
              Line-height tokens preserve hierarchy between headings, body copy, and dense tables.
            </p>
          </div>
          <TokenList items={lineHeights} />
        </section>

        <section className="brand-section">
          <div className="brand-section__header">
            <h2 className="brand-section__title">Weights</h2>
            <p className="brand-section__description">
              Weight tokens balance legibility and emphasis, especially for bilingual copy.
            </p>
          </div>
          <TokenList items={fontWeights} />
        </section>
      </div>
    </div>
  );
}

export const Typography: Story = {
  name: "Typography",
  render: () => <TypographyStory />,
};
