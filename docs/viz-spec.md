# Visualization Specification

This document defines how data visualizations are configured, rendered, and delivered across Summa Vision properties. It covers the baseline configuration format for Vega-Lite and Observable Plot charts, guidelines for extending the configuration for bespoke D3 visualizations, acceptance criteria for common chart types, and non-functional requirements such as export, accessibility, and embedding.

## 1. Configuration Structure

All visualizations share a common envelope that identifies the rendering engine and supplies a configuration payload. The payload MUST be valid JSON and conform to the selected engine's schema.

```json
{
  "id": "unique-chart-id",
  "title": "Human readable title",
  "description": "Short description used in tooltips and aria labels",
  "engine": "vega-lite" | "observable-plot" | "d3-custom",
  "config": { /* engine-specific definition */ },
  "dataSources": [
    {
      "name": "primary",
      "type": "inline" | "remote" | "cms",
      "format": "csv" | "json" | "topojson",
      "value": {},
      "transform": [ /* optional array of transforms applied prior to rendering */ ]
    }
  ],
  "defaults": {
    "tooltip": true,
    "legend": "auto",
    "annotations": []
  }
}
```

### 1.1 Vega-Lite Configuration

The `config` payload MUST be a valid [Vega-Lite v5](https://vega.github.io/vega-lite/) specification. The following conventions apply:

* `config.view.stroke` defaults to `null` to remove borders unless explicitly overridden.
* `data` should reference an entry from `dataSources` via `name` when possible to avoid duplication.
* All encodings MUST include `title` metadata for accessibility.
* When using interactive selections, namespace them under `params` with lowercase snake case names.

### 1.2 Observable Plot Configuration

The `config` payload MUST be an object compatible with [Observable Plot](https://observablehq.com/plot) `Plot.plot` options.

* `marks` is an array of mark definitions, each with a `type`, `data`, and optional `tip`, `legend`, and `ariaLabel` fields.
* Data bindings should reference `dataSources` by `name` when possible; inline arrays are acceptable for small datasets (< 500 rows).
* Use `Plot.scale` for shared scales across marks and declare `plot.facet` for small multiples.
* Provide `Plot.axisX`/`Plot.axisY` specifications that include `label` and `tickFormat` when a unit is implied.

### 1.3 D3 Custom Extensions

For charts that require custom D3 logic beyond Vega-Lite or Observable Plot capabilities, use the following extension contract:

```json
{
  "engine": "d3-custom",
  "config": {
    "module": "@summa/viz/custom/my-chart.js",
    "props": {
      "width": 640,
      "height": 400,
      "margins": { "top": 24, "right": 24, "bottom": 48, "left": 64 },
      "data": "primary",
      "options": { /* arbitrary chart-specific options */ }
    }
  }
}
```

* `module` references an ES module path exported from our visualization bundle.
* `props.data` MUST point to a `dataSources.name` entry. The renderer is responsible for injecting the resolved dataset.
* Custom modules MUST export a default function `(el, props) => teardown`, where `teardown` is an optional cleanup callback.
* Annotate any custom keyboard interactions inside the module to ensure they can be audited for accessibility.

## 2. Acceptance Criteria by Chart Type

For each chart type, the renderer MUST satisfy the following requirements.

### 2.1 Line Charts

* Supports single or multiple series with shared x-axis.
* Provides hover tooltips displaying x value, series name, and y value.
* Includes a legend identifying series with color swatches.
* Allows annotations via vertical rule and text label referencing data points.

### 2.2 Area Charts

* Supports baseline at zero and custom baselines.
* Tooltips show the cumulative value at the hovered x along with individual series when stacked.
* Legend indicates fill colors and stroke styling when applicable.
* Handles annotations positioned on filled regions with contrasting text color.

### 2.3 Bar Charts

* Supports vertical and horizontal orientations toggled via configuration.
* Tooltips report category, value, and optional percentage of total.
* Legend required when color encodes additional dimension; hidden otherwise.
* Annotations can attach to bars via markers positioned at bar centers.

### 2.4 Stacked Charts (Bar/Area)

* Correctly computes stacking order based on `stack` encoding or explicit series order.
* Tooltips display both individual segment values and cumulative totals.
* Provides legend entries for each stack segment with consistent ordering.
* Supports annotations for overall totals and individual stack segments.

### 2.5 Treemap Charts

* Accepts hierarchical data with value field for area sizing.
* Tooltips show node name, value, and percentage of parent.
* Legend explains color encoding (e.g., category or depth).
* Allows annotations via callouts anchored to specific rectangles.

### 2.6 Map Charts (Choropleth / Symbol)

* Supports GeoJSON/TopoJSON inputs with projection configuration.
* Tooltips display geographic name, value, and units.
* Legend supports sequential/diverging color scales with labeled thresholds.
* Provides annotation capability via pins or inset text for notable regions.

## 3. Export Capabilities

All chart renderers MUST support the following export options:

* **PNG Export** – Renders the chart at 2× resolution with transparent background by default and includes the chart title as metadata (`tEXt` chunk for PNG).
* **SVG Export** – Generates clean SVG output with embedded fonts (or fallbacks) and preserves ARIA attributes.
* Export triggers are available via UI controls and programmatic API (`viz.export({ type: 'png' | 'svg' })`).

## 4. Accessibility Requirements

* Every chart MUST expose a machine-readable data table, rendered as `<table>` markup adjacent to the visualization or accessible via an “View data table” control.
* Provide textual descriptions (`aria-description` or `<figcaption>`) summarizing key insights.
* Ensure focusable elements (tooltips, controls, annotations) follow a logical tab order and include keyboard activation.
* Color palettes must satisfy WCAG 2.1 contrast ratios when used for text or annotations.

## 5. Embedding Options

Charts can be embedded in external sites using the following mechanisms:

* **Iframe Embed** – Provide an iframe snippet with sandboxed origin, responsive sizing via `width="100%"` and `height` attribute derived from chart aspect ratio.
* **Script Embed** – Offer a script tag that bootstraps the chart into a specified DOM selector, e.g., `<script src="https://cdn.summa.vision/embed.js" data-chart-id="unique-chart-id"></script>`.
* Both embed modes must support configuration overrides via URL parameters or `data-*` attributes (e.g., `data-theme`, `data-locale`).
* Embeds MUST load asynchronously, avoid blocking host page rendering, and expose a `ready` event for analytics integration.

