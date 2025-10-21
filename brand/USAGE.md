# Token Usage Handbook

This guide shows how to consume Summa Vision design tokens in CSS and TypeScript. The build pipeline emits:

- `styles/tokens.css` — CSS custom properties for runtime theming.
- `styles/typography.css` — helper classes and base defaults.
- `src/shared/theme/tokens.ts` — a typed token map for JavaScript/TypeScript.

## Installing Dependencies

```bash
npm install
npm run build:tokens
```

The `build:tokens` script compiles `tokens/brand.tokens.json` using Style Dictionary. Regenerate tokens whenever the source JSON changes.

## Using Tokens in CSS

```css
@import url('../styles/tokens.css');
@import url('../styles/typography.css');

.button-primary {
  background-color: var(--color-fg-accent);
  color: var(--color-fg-inverse);
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius-m);
  box-shadow: var(--shadow-z1);
  transition: background-color var(--motion-duration-base) var(--motion-easing-standard);
}

.button-primary:focus-visible {
  outline: 3px solid var(--color-border-focus);
  outline-offset: 2px;
}
```

## Using Tokens in TypeScript

```ts
import { getTokenValue, TokenPath } from '../shared/theme/tokens';

type PillVariant = 'default' | 'success';

const tokenByVariant: Record<PillVariant, TokenPath> = {
  default: 'color.fg.accent',
  success: 'color.statusSurface.ok.fg',
};

export function getVariantColor(variant: PillVariant) {
  return getTokenValue(tokenByVariant[variant]);
}
```

## Authoring New Tokens

1. Edit `tokens/brand.tokens.json`. Use semantic names (e.g., `color.bg.canvas`).
2. Reference other tokens using the `{token.path}` syntax to avoid duplicating values.
3. Run `npm run build:tokens` to generate artifacts.
4. Commit the updated JSON and generated files.

### Naming Conventions
- **Colors:** `color.<layer>.<role>` (`color.border.subtle`, `color.status.ok`).
- **Typography:** `font.size.*`, `font.lineHeight.*`, `font.weight.*`.
- **Spacing:** `space.1` (4px increments). Use `.0` for zero spacing.
- **Shadows:** `shadow.z1` → depth increases with number.
- **Motion:** `motion.duration.*`, `motion.easing.*`.

## Theme Switching

OG templates and future Storybook examples read CSS variables directly. To create a dark theme, wrap content with a `[data-theme="dark"]` attribute and override the semantic tokens:

```css
[data-theme='dark'] {
  color-scheme: dark;
  --color-bg-canvas: var(--color-neutral-950);
  --color-bg-surface: var(--color-neutral-900);
  --color-fg-default: var(--color-neutral-050);
  --color-border-default: var(--color-neutral-800);
}
```

Only override semantic tokens—never palette tokens—to keep the system consistent.

## Linting Guardrails

Run `npm run lint:no-raw-colors` before committing. The script fails if raw HEX/RGB colors are found outside the token sources and generated artifacts.
