import type { Meta, StoryObj } from "@storybook/react";
import React from "react";

import "./brand-stories.css";
import type { TokenMeta } from "./utils";
import { resolveToken, tokenPathToCssVar } from "./utils";

type PaletteGroup = {
  title: string;
  description: string;
  swatches: (TokenMeta & { previewText?: string; textColorToken?: TokenMeta["token"] })[];
};

const paletteGroups: PaletteGroup[] = [
  {
    title: "Brand & Accent",
    description: "Primary brand accent paired with the supporting accent ramp.",
    swatches: [
      { token: "color.brand.blue.500", label: "Brand Blue 500", previewText: "Brand" },
      { token: "color.fg.accent", label: "Semantic Accent", previewText: "Accent" },
      { token: "color.accent.teal", label: "Teal", previewText: "Teal" },
      { token: "color.accent.violet", label: "Violet", previewText: "Violet" },
      { token: "color.accent.magenta", label: "Magenta", previewText: "Magenta" },
      { token: "color.accent.orange", label: "Orange", previewText: "Orange" },
      {
        token: "color.accent.yellow",
        label: "Yellow",
        previewText: "Yellow",
        textColorToken: "color.fg.default",
      },
    ],
  },
  {
    title: "Neutral Ramp",
    description: "Neutral values for surfaces, typography, and borders.",
    swatches: [
      {
        token: "color.neutral.000",
        label: "000",
        previewText: "000",
        textColorToken: "color.fg.muted",
      },
      {
        token: "color.neutral.050",
        label: "050",
        previewText: "050",
        textColorToken: "color.fg.muted",
      },
      {
        token: "color.neutral.100",
        label: "100",
        previewText: "100",
        textColorToken: "color.fg.muted",
      },
      {
        token: "color.neutral.200",
        label: "200",
        previewText: "200",
        textColorToken: "color.fg.muted",
      },
      {
        token: "color.neutral.300",
        label: "300",
        previewText: "300",
        textColorToken: "color.fg.muted",
      },
      { token: "color.neutral.400", label: "400", previewText: "400" },
      { token: "color.neutral.500", label: "500", previewText: "500" },
      { token: "color.neutral.600", label: "600", previewText: "600" },
      { token: "color.neutral.700", label: "700", previewText: "700" },
      { token: "color.neutral.800", label: "800", previewText: "800" },
      { token: "color.neutral.900", label: "900", previewText: "900" },
      { token: "color.neutral.950", label: "950", previewText: "950" },
    ],
  },
  {
    title: "UI Layers",
    description: "Semantic layers applied across product and editorial interfaces.",
    swatches: [
      {
        token: "color.bg.canvas",
        label: "Canvas",
        previewText: "Canvas",
        textColorToken: "color.fg.muted",
      },
      {
        token: "color.bg.surface",
        label: "Surface",
        previewText: "Surface",
        textColorToken: "color.fg.muted",
      },
      {
        token: "color.bg.elevated",
        label: "Elevated",
        previewText: "Elevated",
        textColorToken: "color.fg.muted",
      },
      {
        token: "color.bg.subtle",
        label: "Subtle",
        previewText: "Subtle",
        textColorToken: "color.fg.muted",
      },
      { token: "color.bg.inverse", label: "Inverse", previewText: "Inverse" },
      {
        token: "color.fg.default",
        label: "FG Default",
        previewText: "Aa",
        textColorToken: "color.bg.canvas",
      },
      {
        token: "color.fg.muted",
        label: "FG Muted",
        previewText: "Aa",
        textColorToken: "color.bg.canvas",
      },
      {
        token: "color.fg.subtle",
        label: "FG Subtle",
        previewText: "Aa",
        textColorToken: "color.bg.canvas",
      },
      { token: "color.fg.inverse", label: "FG Inverse", previewText: "Aa" },
    ],
  },
  {
    title: "Borders & Focus",
    description: "Outlines and focus rings maintain consistent contrast.",
    swatches: [
      { token: "color.border.subtle", label: "Border Subtle", previewText: "1px" },
      { token: "color.border.default", label: "Border Default", previewText: "1px" },
      { token: "color.border.emphasis", label: "Border Emphasis", previewText: "1px" },
      { token: "color.border.inverse", label: "Border Inverse", previewText: "1px" },
      { token: "color.border.focus", label: "Focus Ring", previewText: "Focus" },
    ],
  },
  {
    title: "Statuses",
    description: "Foreground tokens for inline messaging and indicators.",
    swatches: [
      { token: "color.status.ok", label: "Status OK", previewText: "OK" },
      {
        token: "color.status.warn",
        label: "Status Warn",
        previewText: "Warn",
        textColorToken: "color.bg.canvas",
      },
      { token: "color.status.alert", label: "Status Alert", previewText: "Alert" },
      { token: "color.status.info", label: "Status Info", previewText: "Info" },
    ],
  },
];

const statusSurfaceSpecs: Array<{
  title: string;
  fg: TokenMeta["token"];
  bg: TokenMeta["token"];
  border: TokenMeta["token"];
}> = [
  {
    title: "OK",
    fg: "color.statusSurface.ok.fg",
    bg: "color.statusSurface.ok.bg",
    border: "color.statusSurface.ok.border",
  },
  {
    title: "Warn",
    fg: "color.statusSurface.warn.fg",
    bg: "color.statusSurface.warn.bg",
    border: "color.statusSurface.warn.border",
  },
  {
    title: "Alert",
    fg: "color.statusSurface.alert.fg",
    bg: "color.statusSurface.alert.bg",
    border: "color.statusSurface.alert.border",
  },
  {
    title: "Info",
    fg: "color.statusSurface.info.fg",
    bg: "color.statusSurface.info.bg",
    border: "color.statusSurface.info.border",
  },
];

const meta = {
  title: "Brand/Palette",
  component: PaletteStory,
  parameters: {
    docs: {
      description: {
        component:
          "Visual reference for Summa Vision color tokens. Swatches pull raw values from the generated `tokens.ts` map and CSS custom properties.",
      },
    },
  },
} satisfies Meta<typeof PaletteStory>;

export default meta;

type Story = StoryObj<typeof meta>;

function SwatchCard({
  token,
  label,
  previewText,
  textColorToken,
}: {
  token: TokenMeta["token"];
  label?: string;
  previewText?: string;
  textColorToken?: TokenMeta["token"];
}) {
  const cssVariable = tokenPathToCssVar(token);
  const value = resolveToken(token);
  const textColor = textColorToken ? `var(${tokenPathToCssVar(textColorToken)})` : undefined;

  return (
    <article className="brand-card">
      <div
        className="brand-swatch__preview"
        style={{
          background: `var(${cssVariable})`,
          color: textColor,
        }}
      >
        {previewText}
      </div>
      <div className="brand-card__body">
        <div>
          <strong>{label ?? token}</strong>
        </div>
        <div className="brand-token-meta">
          <div>
            Token: <code>{token}</code>
          </div>
          <div>
            CSS: <code>var({cssVariable})</code>
          </div>
          <div>
            Value: <code>{value}</code>
          </div>
        </div>
      </div>
    </article>
  );
}

function StatusSurfaceCard({ title, fg, bg, border }: (typeof statusSurfaceSpecs)[number]) {
  const fgValue = resolveToken(fg);
  const bgValue = resolveToken(bg);
  const borderValue = resolveToken(border);
  const fgVar = tokenPathToCssVar(fg);
  const bgVar = tokenPathToCssVar(bg);
  const borderVar = tokenPathToCssVar(border);

  return (
    <article className="brand-card">
      <div
        className="brand-swatch__preview"
        style={{
          background: `var(${bgVar})`,
          color: `var(${fgVar})`,
          borderBottom: `1px solid var(${borderVar})`,
        }}
      >
        {title} Message
      </div>
      <div className="brand-card__body">
        <div>
          <strong>{title} Surface</strong>
          <p className="brand-note">
            Foreground, background, and border tokens for status messaging.
          </p>
        </div>
        <div className="brand-token-meta">
          <div>
            FG: <code>{fg}</code> = <code>{fgValue}</code>
          </div>
          <div>
            BG: <code>{bg}</code> = <code>{bgValue}</code>
          </div>
          <div>
            Border: <code>{border}</code> = <code>{borderValue}</code>
          </div>
        </div>
      </div>
    </article>
  );
}

function PaletteStory() {
  return (
    <div className="brand-story">
      <div className="brand-story__content">
        {paletteGroups.map((group) => (
          <section key={group.title} className="brand-section">
            <div className="brand-section__header">
              <h2 className="brand-section__title">{group.title}</h2>
              <p className="brand-section__description">{group.description}</p>
            </div>
            <div className="brand-grid brand-grid--swatches">
              {group.swatches.map((swatch) => (
                <SwatchCard key={swatch.token} {...swatch} />
              ))}
            </div>
          </section>
        ))}

        <section className="brand-section">
          <div className="brand-section__header">
            <h2 className="brand-section__title">Status Surfaces</h2>
            <p className="brand-section__description">
              Layered combinations ensure accessible contrast between copy, fills, and outlines.
            </p>
          </div>
          <div className="brand-grid brand-grid--swatches">
            {statusSurfaceSpecs.map((spec) => (
              <StatusSurfaceCard key={spec.title} {...spec} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export const Palette: Story = {
  name: "Palette",
  render: () => <PaletteStory />,
};
