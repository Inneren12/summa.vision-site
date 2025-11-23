# Visualization CSS Strategy (S7-95, Pattern B)

This document explains how we handle CSS for visualization libraries in `apps/web`.
The goal is to keep global styles predictable and avoid accidental library-wide CSS side effects.

## MapLibre GL CSS (Pattern B)

- **Canonical import:** `maplibre-gl/dist/maplibre-gl.css` is imported globally from `apps/web/app/layout.tsx`. Next.js requires global CSS to live in the root layout/page.
- **Do not import elsewhere:** Components, adapters, stories, and tests **must not** import `maplibre-gl/dist/maplibre-gl.css` directly.
- **Why:** Centralizing the stylesheet keeps bundle shape stable and avoids duplicated or missing styles when maps render in different routes.

## Other visualization libraries (Vega-Lite, ECharts, deck.gl, visx)

- **No global vendor CSS imports.** Avoid statements like `import 'echarts/dist/echarts.css'` or `import '@deck.gl/core/dist/styles.css'`.
- **Prefer scoped styling:** use CSS Modules, Tailwind utility classes, or design tokens to style chart wrappers and tooltips.
- **If a vendor requires default styles:** copy the minimal rules into a project-owned stylesheet and scope them to your component so they do not leak globally.

## Adding new visualizations

- Keep adapters free of global CSS imports; rely on component-level styles instead.
- If you must add CSS for a visualization, place it in a locally owned stylesheet (e.g., `Component.module.css`) and document the scope.
- Run the guard to ensure compliance: `npm run check:viz-css`.

## Guardrail

The script `scripts/check-viz-css-imports.mjs` enforces this strategy and is wired to `npm run check:viz-css` and CI. It allows the canonical MapLibre import only in `apps/web/app/layout.tsx` and rejects global vendor CSS elsewhere. If it fails, remove the offending import or relocate the styles into a scoped, project-owned file.

## Scrolly Binding (S6 → S7)

Use `useScrollyBindingViz` to drive a visualization instance from scrolly step changes. The hook subscribes to the S6
`activeStepId` stream (via `useActiveStepSubscription` by default) and calls `viz.applyState` with the mapped state returned by
`mapStepToState`.

```tsx
import { useVizMount } from "@/lib/viz/useVizMount";
import { useScrollyBindingViz } from "@/lib/viz/useScrollyBindingViz";

// Inside a client component wrapped by <ScrollyProvider />
const viz = useVizMount<MyState, MySpec>({ adapter, spec });

useScrollyBindingViz<MyState>({
  viz: viz.instance,
  debugLabel: "Story/Map",
  mapStepToState: (step) => {
    switch (step.stepId) {
      case "intro":
        return { highlight: null };
      case "detail":
        return { highlight: "region-42" };
      default:
        return null;
    }
  },
});
```

If you need a custom step source (for example, when the scrolly engine runs outside of React), pass `subscribeActiveStep` to
provide your own subscription function.
