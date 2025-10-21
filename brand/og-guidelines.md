# Open Graph (OG) Image Guidelines

Keep Summa Vision social previews accessible, legible, and on-brand across platforms.

## Dimensions & Safe Area
- **Artboard size:** 1200 × 630px (1.91:1 ratio) — compatible with LinkedIn, X, Facebook, Slack.
- **Safe text area:** Inset content by `space.8` (32px) on all sides (resulting safe zone: 1040 × 566px). Place critical copy, logos, and data within this area.
- **Background bleed:** Extend backgrounds to the full canvas to avoid visible edges on rounded previews.

## Background Treatments
- Default light theme: `color.bg.canvas` to `color.bg.surface` gradient (optional) with contrast-compliant overlays.
- Default dark theme: `color.bg.inverse` to `color.neutral.800` gradient. Maintain 4.5:1 contrast between text (`color.fg.default` or `color.neutral.050`) and the background.
- Photography overlays: apply `color-mix(in srgb, var(--color-neutral-950) 70%, transparent)` on bright imagery or `color-mix(in srgb, var(--color-neutral-050) 30%, transparent)` on dark imagery before placing text.

## Typography
- Headline: `.h1` (or `.display` for hero narratives) with `font.weight.semibold` and `letter-spacing: -0.015em`.
- Supporting copy: `.h4` or `.body` with `color.fg.muted`.
- Metadata chip: `.caption` inside a pill using `color.bg.subtle` (light) or `color.neutral.800` (dark) with `radius.full` corners.
- Always enable `font-variant-numeric: tabular-nums` for stats (included in base typography stylesheet).

## Logo & Accent Placement
- Position the logomark at the top-left corner of the safe area; scale to 96px height (approx. `space.24`).
- Maintain `space.6` (24px) between the mark and wordmark when used together.
- Use `color.fg.accent` for accent glyphs and highlights. Avoid introducing non-token colors.

## Layout Variations
- **Product feature:** Vertical split at 640px. Use `color.border.default` for the divider and place UI captures on the right.
- **Thought leadership:** Centered headline above the wordmark; add a `color.fg.accent` underline at `space.3` thickness.
- **Event announcement:** Metadata chip in the top-right safe corner; align title left for balance.

## Export Checklist
- Include `styles/tokens.css` and `styles/og.css` when rendering with `scripts/og-render.ts`.
- Run `npm run test:axe` to ensure templates pass automated accessibility checks.
- Output PNG by default; provide JPEG fallback (85% quality) if file size must be <1 MB.
- Verify final contrast ratios meet WCAG AA using design tooling or the automated checks.
