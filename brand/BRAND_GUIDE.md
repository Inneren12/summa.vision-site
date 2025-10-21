# Summa Vision Brand Guide v1.0

The Summa Vision identity pairs luminous data storytelling with rigorous accessibility. Use this guide when composing layouts, applying the logotype, or building new assets.

## Logo & Mark

### Clear Space
- Maintain a minimum clear space of `space.4` (16px) around the standalone mark and wordmark lockups.
- When the mark and wordmark are stacked, increase the clearance beneath the mark to `space.6` (24px) to balance the optical weight of the dot.
- For hero or cover imagery, leave at least `space.8` (32px) between the outer clear space boundary and the artboard edge.

### Minimum Sizes
| Asset | Minimum Size | Notes |
| --- | --- | --- |
| Standalone mark | 24px height | Preserves interior angles of the "V" cutout. |
| Wordmark | 128px width | Ensures counterspaces remain legible on high-density screens. |
| Combined lockup | 160px width | Use for navigation bars and metadata strips. |

### Color Application
- **Light backgrounds:** Prefer `color.bg.canvas` or `color.bg.surface`. When overlaying photography, add a translucent `color.neutral.900` wash (60%) to maintain contrast for the dot.
- **Dark backgrounds:** Set the mark on `color.neutral.900` or darker. Introduce a subtle `shadow.z1` to keep the dot luminous without adding gradients.
- **Do not:** recolor the dot, add drop shadows that deviate from tokenized shadows, skew the mark, or place it on patterned backgrounds that break the clear space rules.

## Color System

### UI Palette
| Role | Light Theme | Dark Theme |
| --- | --- | --- |
| Canvas | `color.bg.canvas` | `color.bg.inverse` |
| Surface | `color.bg.surface` | `color.neutral.800` |
| Elevated | `color.bg.elevated` + `shadow.z1` | `color.neutral.900` + `shadow.z2` |
| Text (Default) | `color.fg.default` | `color.neutral.050` |
| Text (Muted) | `color.fg.muted` | `color.neutral.400` |
| Border | `color.border.default` | `color.border.inverse` |
| Accent | `color.fg.accent` | `color.brand.blue.300` |

### Status Treatments
Use the following combinations for alerts and inline statuses:

| State | Foreground | Background | Border |
| --- | --- | --- | --- |
| Success | `color.statusSurface.ok.fg` | `color.statusSurface.ok.bg` | `color.statusSurface.ok.border` |
| Warning | `color.statusSurface.warn.fg` | `color.statusSurface.warn.bg` | `color.statusSurface.warn.border` |
| Alert | `color.statusSurface.alert.fg` | `color.statusSurface.alert.bg` | `color.statusSurface.alert.border` |
| Info | `color.statusSurface.info.fg` | `color.statusSurface.info.bg` | `color.statusSurface.info.border` |

### Data Visualization Series
- Always map categorical series from `color.series.1` through `color.series.12` in order; do not shuffle unless you reset the legend.
- For diverging charts, pair `color.series.1` with `color.series.11` and `color.series.2` with `color.series.10` to maintain balance.
- Gridlines should only use `color.grid.major` and `color.grid.minor` to maintain sufficient contrast against both light and dark backgrounds.

## Typography

### System Stack
- Primary sans-serif: `font.family.sans`
- Monospace / data: `font.family.mono`
- Apply `font-variant-numeric: tabular-nums` to all numeric data blocks.

### Scale & Usage
| Style | Token | Line Height | Usage |
| --- | --- | --- | --- |
| Display | `font.size.display` | `font.lineHeight.tight` | Hero headlines, marquee storytelling moments. |
| H1 | `font.size.h1` | `font.lineHeight.tight` | Section anchors and product hero titles. |
| H2 | `font.size.h2` | `font.lineHeight.snug` | Feature callouts and high-level metrics. |
| H3 | `font.size.h3` | `font.lineHeight.snug` | Card titles, inline analytics. |
| H4 | `font.size.h4` | `font.lineHeight.normal` | Subheadlines, summary text. |
| H5 | `font.size.h5` | `font.lineHeight.normal` | UI labels, secondary navigation. |
| H6 | `font.size.h6` | `font.lineHeight.normal` | Caption headers, taglines. |
| Body | `font.size.body` | `font.lineHeight.normal` | Long-form copy, paragraphs. |
| Caption | `font.size.caption` | `font.lineHeight.snug` | Eyebrow labels, metadata, chart axes. |
| Mono | `font.size.bodySm` | `font.lineHeight.snug` | Tables, code snippets, inline stats. |

### Motion & Interaction
- Use `motion.duration.fast` for hover states, `motion.duration.base` for standard transitions, and `motion.duration.gentle` for theme changes or page loads.
- Easing defaults to `motion.easing.cubic`. Use `motion.easing.emphasized` for entrance animations and `motion.easing.exit` for dismissals.

## Spacing, Radius & Shadow

### Spacing
- Base unit: `space.1` = 4px.
- Core rhythm: `space.4` for card padding, `space.6` for grid gutters, `space.8` for section spacing.
- Macro layout: combine multiples to reach 64px (useful for hero splits) and 96px (margin above the footer).

### Corner Radius
- `radius.sm` (4px) for buttons, pills, and text inputs.
- `radius.md` (8px) for cards and popovers.
- `radius.lg` (12px) for modals and large tiles.
- `radius.full` for circular avatars and dot treatments.

### Shadows
| Token | Usage |
| --- | --- |
| `shadow.z1` | Resting cards, buttons. |
| `shadow.z2` | Sticky nav, modals, tooltips. |
| `shadow.z3` | Full-bleed dialogs, command palettes. |

## Misuse Checklist
- Do not introduce un-tokenized hex or RGB values in production CSS/TS.
- Avoid gradients that are not derived from `color.brand.blue.*` or the neutral ramp.
- Never distort, rotate, or add outlines to the wordmark.
- Maintain WCAG AA contrast for all text and interactive elements by pairing the specified foreground/background tokens.

For questions or requests, contact the Brand Systems team via `brand@summa.vision`.
