import type { Meta, StoryObj } from "@storybook/react";
import React from "react";

import "./brand-stories.css";
import type { TokenMeta } from "./utils";
import { resolveToken, tokenPathToCssVar } from "./utils";

const shadowTokens: TokenMeta[] = [
  { token: "shadow.z1", label: "Shadow Z1", description: "Resting cards, buttons" },
  { token: "shadow.z2", label: "Shadow Z2", description: "Sticky nav, modals" },
  { token: "shadow.z3", label: "Shadow Z3", description: "Command palettes, dialogs" },
];

const radiusTokens: TokenMeta[] = [
  { token: "radius.xs", label: "Radius XS", description: "Pills, chips" },
  { token: "radius.sm", label: "Radius SM", description: "Buttons, inputs" },
  { token: "radius.md", label: "Radius MD", description: "Cards, popovers" },
  { token: "radius.lg", label: "Radius LG", description: "Modals, sheets" },
  { token: "radius.xl", label: "Radius XL", description: "Hero tiles" },
  { token: "radius.2xl", label: "Radius 2XL", description: "Feature callouts" },
  { token: "radius.full", label: "Radius Full", description: "Avatars, dot motif" },
];

const meta = {
  title: "Brand/Elevation",
  component: ElevationStory,
  parameters: {
    docs: {
      description: {
        component:
          "Shadow and radius primitives applied to representative UI blocks. Preview cards read CSS custom properties while metadata references `tokens.ts`.",
      },
    },
  },
} satisfies Meta<typeof ElevationStory>;

export default meta;

type Story = StoryObj<typeof meta>;

function ShadowCard({ spec }: { spec: TokenMeta }) {
  const value = resolveToken(spec.token);
  const cssVar = tokenPathToCssVar(spec.token);
  return (
    <div className="brand-shadow-preview__item" style={{ boxShadow: `var(${cssVar})` }}>
      <div>
        <strong>{spec.label ?? spec.token}</strong>
        {spec.description ? <p className="brand-note">{spec.description}</p> : null}
      </div>
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
  );
}

function RadiusCard({ spec }: { spec: TokenMeta }) {
  const value = resolveToken(spec.token);
  const cssVar = tokenPathToCssVar(spec.token);
  return (
    <article className="brand-card">
      <div className="brand-card__body">
        <div className="brand-radius-preview">
          <div className="brand-radius-preview__shape" style={{ borderRadius: `var(${cssVar})` }} />
        </div>
        <div>
          <strong>{spec.label ?? spec.token}</strong>
          {spec.description ? <p className="brand-note">{spec.description}</p> : null}
        </div>
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

function ElevationStory() {
  return (
    <div className="brand-story">
      <div className="brand-story__content">
        <section className="brand-section">
          <div className="brand-section__header">
            <h2 className="brand-section__title">Shadows</h2>
            <p className="brand-section__description">
              Each layer references a tokenized composite shadow to keep elevations consistent
              across surfaces.
            </p>
          </div>
          <div className="brand-shadow-preview">
            {shadowTokens.map((token) => (
              <ShadowCard key={token.token} spec={token} />
            ))}
          </div>
        </section>

        <section className="brand-section">
          <div className="brand-section__header">
            <h2 className="brand-section__title">Radius Scale</h2>
            <p className="brand-section__description">
              Corner radii maintain a soft geometry that still feels precise in dense dashboards.
            </p>
          </div>
          <div className="brand-radius-grid">
            {radiusTokens.map((token) => (
              <RadiusCard key={token.token} spec={token} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export const Elevation: Story = {
  name: "Elevation",
  render: () => <ElevationStory />,
};
