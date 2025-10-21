# Open Graph (OG) Image Guidelines

These specifications ensure Summa Vision social previews remain legible and recognizably on-brand across platforms.

## Dimensions & Safe Area
- **Artboard size:** 1200 × 630px (1.91:1 aspect ratio). This resolution renders crisply on LinkedIn, Twitter/X, Facebook, and Slack.
- **Safe text area:** Keep essential copy and the logomark within a 1040 × 520px center zone (80px inset from all sides) to avoid cropping on narrower previews.
- **Background bleed:** Extend background imagery or gradients to the full canvas to prevent visible edges when platforms apply rounding.

## Background Treatments
- Default to the dark theme hero gradient using `surface.base.dark` fading to `surface.alt.dark` from left to right.
- For light-theme narratives, invert the gradient with `surface.base.light` to `surface.alt.light` while maintaining a minimum 4.5:1 contrast between any overlaid text and the background.
- When using photography, apply a color wash: `rgba(13, 17, 23, 0.72)` for bright imagery, `rgba(255, 255, 255, 0.28)` for dark imagery to keep overlay copy readable.

## Typography
- **Headline:** `Space Grotesk` Bold, 72px, tracking -2%, set in uppercase for feature launches. Limit to 32 characters per line.
- **Supporting copy:** `Inter` Medium, 40px, tracking 0%, max two lines. Maintain 48px leading to align with OG safe area rhythm.
- **Metadata chip (optional):** `Inter` SemiBold, 28px, all caps, enclosed in a pill with 16px horizontal padding and `surface.raised.dark` fill.

## Logo & Accent Placement
- Position the "V" logomark in the upper-left corner, 80px from the top and left edges (aligned with the safe area). Scale the mark to 96px height.
- Set the wordmark lockup along the bottom-left of the safe area, baseline aligned 80px from the bottom edge. Maintain `space.6` (24px) between the logomark and wordmark when both appear.
- Anchor the accent dot glow using `accent.active.dark` on dark backgrounds or `accent.active.light` on light backgrounds; ensure 7:1 contrast with adjacent surfaces by applying the appropriate overlay halo.

## Layout Variations
- **Product feature:** Split layout with a vertical divider at 640px. Place screenshots or diagrams on the right, constrained to the safe area. Use a subtle `surface.raised.dark` border (2px) to frame imagery.
- **Thought leadership:** Centered headline stacked above the wordmark; introduce an `accent.violet` underline at `space.3` thickness spanning the headline width.
- **Event announcement:** Place date/time metadata chip top-right within the safe area; align the main headline left for balance with the logomark.

## Export Checklist
- Embed fonts or convert to outlines before export to prevent fallback substitutions.
- Export as PNG for most platforms; supply a JPG variant at 85% quality when file size must remain under 1 MB.
- Verify contrast ratios with accessibility tooling (e.g., Stark, Contrast) to maintain WCAG AA+ targets.
