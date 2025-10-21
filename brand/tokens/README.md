# Brand Tokens & Usage Guidelines

This document defines the reusable tokens and layout rules that anchor the Summa Vision identity. All color values are expressed as hex (`#RRGGBB`) and Hue/Saturation/Brightness (HSB) percentages.

## Color System

### Primary Accent
| Token | Hex | HSB | Notes |
| --- | --- | --- | --- |
| `accent.blue.dot` | `#2962FF` | `227° / 83% / 100%` | Primary blue dot used in the "V" logomark nucleus and interactive states.

### Theme Palettes

#### Light Interface
| Token | Hex | Role |
| --- | --- | --- |
| `surface.base.light` | `#FFFFFF` | Primary canvas for marketing pages and documentation.
| `surface.alt.light` | `#F5F7FA` | Elevated cards and form containers; pairs with subtle shadows.
| `surface.raised.light` | `#E6EBF0` | Table headers, navigation rails, and input backgrounds.
| `text.primary.light` | `#161B22` | Default body copy; always 4.5:1 contrast or greater on light surfaces.
| `text.secondary.light` | `#2D333B` | Muted labels, metadata, and iconography.
| `accent.active.light` | `#2962FF` | Buttons, links, focus outlines; ensure 3px radius focus halo.

#### Dark Interface
| Token | Hex | Role |
| --- | --- | --- |
| `surface.base.dark` | `#0D1117` | Hero backgrounds and immersive sections.
| `surface.alt.dark` | `#161B22` | Page chrome, navigation rails, and inset cards.
| `surface.raised.dark` | `#2D333B` | Overlays, popovers, and segmented controls.
| `text.primary.dark` | `#F5F7FA` | Primary copy; retains legibility at 4.5:1 or greater contrast.
| `text.secondary.dark` | `#C1C8D0` | Supporting copy and UI affordances.
| `accent.active.dark` | `#1DD3F8` | Hover states, data highlights, and secondary CTAs on dark surfaces.

### Background Application
- Anchor hero sections on `surface.base.dark` to give the dot accent luminosity; introduce gradients only when values stay within the `surface.alt.dark`–`surface.raised.dark` range.
- Use `surface.base.light` for documentation and long-form reading. Introduce `surface.alt.light` to differentiate cards or data callouts while maintaining a minimum `space.4` separation.
- When transitioning between themes, fade between the base surfaces over 200ms to avoid abrupt shifts. Accent colors remain constant across modes to strengthen recognition.

### Grayscale Ramp
| Token | Hex | HSB | Usage |
| --- | --- | --- | --- |
| `gray.950` | `#0D1117` | `220° / 53% / 9%` | Background for dark hero panels; ensures contrast with accent dot.
| `gray.900` | `#161B22` | `222° / 39% / 13%` | Page chrome and navigation rail.
| `gray.700` | `#2D333B` | `217° / 26% / 23%` | Secondary surfaces, cards, and input borders.
| `gray.500` | `#636E7B` | `215° / 16% / 49%` | Body copy on dark surfaces; iconography.
| `gray.300` | `#C1C8D0` | `213° / 7% / 82%` | Dividers, hairlines, subtle UI treatments.
| `gray.100` | `#E6EBF0` | `210° / 4% / 94%` | Light mode backgrounds, table headers.
| `gray.050` | `#F5F7FA` | `210° / 2% / 98%` | Elevated cards in light mode, form fills.

### Supporting Accents
| Token | Hex | HSB | Notes |
| --- | --- | --- | --- |
| `accent.cyan` | `#1DD3F8` | `189° / 88% / 97%` | Highlights for data visualizations and hover states.
| `accent.violet` | `#7B61FF` | `252° / 61% / 100%` | Secondary call-to-action emphasis.

### Contrast Guidance
- **Body copy:** Maintain a minimum 4.5:1 contrast ratio (WCAG AA) between `text.primary.*` tokens and their paired surfaces.
- **Key actions:** Buttons and links using `accent.active.*` should reach 7:1 (AA+) against the surface they sit on; introduce `text.primary.*` labels inside filled buttons for 4.5:1 contrast.
- **Supporting copy:** Secondary text may drop to 3:1 contrast only when accompanied by a higher-contrast headline and the content is not critical for task completion.
- **Dot accent:** The blue nucleus should never sit on colors brighter than `surface.alt.light` or darker than `surface.alt.dark`. If placed over imagery, apply an 80% black overlay for light images or 60% white overlay for dark images to achieve 7:1 contrast with the surrounding surface.

## Spacing Scale

Spacing is derived from the modular grid that builds the "V" logomark. The foundational unit is `4px`, matching the internal triangle height of the mark. Use multiples to preserve rhythm between the mark and surrounding components.

| Token | Value | Relationship |
| --- | --- | --- |
| `space.1` | `4px` | Width of a single grid cell inside the "V" logomark.
| `space.2` | `8px` | Double cell; minimum gap between stacked UI elements.
| `space.3` | `12px` | One and a half cells; inner padding for compact badges.
| `space.4` | `16px` | Structural padding for cards and logomark safe-area minimum.
| `space.6` | `24px` | Used for horizontal rhythm in navigation and hero blocks.
| `space.8` | `32px` | Minimum vertical spacing for sections featuring the wordmark.
| `space.12` | `48px` | Preferred breathing room around the logomark in hero compositions.
| `space.16` | `64px` | Maximum gutter before transitioning to macro layout grid.

## Typography

### Primary Pairing
- **Display / Headlines:** `"Space Grotesk", "Segoe UI", "Helvetica Neue", Arial, sans-serif`
  - Weights: 500 (eyebrow labels), 600 (section titles), 700 (hero headlines).
- **Body / UI Copy:** `"Inter", "Helvetica Neue", Arial, sans-serif`
  - Weights: 400 (body text), 500 (buttons & emphasized copy), 600 (caps & metadata).

### Secondary Pairing
- **Editorial Accent:** `"IBM Plex Serif", "Georgia", serif` used sparingly for quotes or long-form thought leadership at weight 400.

Use relative units (`rem`) for scalability: 3.5rem (hero), 2.25rem (section), 1.5rem (subhead), 1rem (body), 0.875rem (supporting meta).

## Logomark Usage

### Safe Area
- Maintain a clear space equal to `space.4` (16px) on all sides of the "V" glyph when placed standalone. The safe area is measured from the outermost edges of the glyph to the nearest graphic or text element.
- When paired with the wordmark, extend the safe area to `space.6` (24px) on the trailing side to accommodate the wordmark's optical balance. Never allow background graphics to intrude on this zone.
- For campaign lockups, reserve a minimum `space.8` (32px) margin from the artboard edges to the safe area to avoid edge crowding.

### Sizing
- **Minimum standalone size:** 24px height (preserves interior angles).
- **Minimum lockup width:** 128px for the combined wordmark (mark + logotype) to maintain legibility.
- **Maximum recommended size:** 320px height for print/digital hero usage before geometric proportions appear heavy.

### Mark-to-Wordmark Relationship
- The wordmark baseline aligns with the lower vertex of the "V" glyph.
- The "V" height sets the cap height of the wordmark: logotype characters scale to 75% of the glyph height.
- Maintain a gap of `space.6` (24px) between the right edge of the glyph and the left edge of the wordmark to echo the grid module.

### Placement Guidance & Dot Accent
- **Light backgrounds:** Place the mark on `surface.base.light` or `surface.alt.light`. Introduce a subtle `#D7DFE7` shadow at 20% opacity offset `0 4px 16px` to keep the dot luminous. Example:

```
[ Light Card ]
┌────────────────────────────┐
│                            │
│      ●   SUMMA VISION      │
│                            │
└────────────────────────────┘
```

- **Dark backgrounds:** Use `surface.base.dark` or hero imagery washed with a 70% black overlay. Add a soft `#0D1117` inner glow to the dot (8px blur) so it appears embedded. Example:

```
[ Dark Hero ]
┌────────────────────────────┐
│                            │
│      ●   SUMMA VISION      │
│                            │
└────────────────────────────┘
```

- **Dot accent alignment:** The dot should always sit on the vertical centerline of the wordmark when used in horizontal lockups. In stacked compositions, center the dot horizontally above the wordmark with `space.4` separation.
- **Photography overlap:** If the dot overlaps photography, apply a translucent ring (`rgba(41, 98, 255, 0.24)`) at `space.2` thickness to preserve contrast while maintaining the glow aesthetic.

## Asset References

Downloadable assets (SVG & PNG) are stored in `/public/brand/`:
- `summa-vision-mark.svg` / `summa-vision-mark.png`
- `summa-vision-wordmark.svg` / `summa-vision-wordmark.png`

Ensure downstream applications reference these canonical files to avoid inconsistent scaling or color shifts.
