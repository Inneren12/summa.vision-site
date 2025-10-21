# CMS Schema

This document outlines the canonical data model for Summa Vision's editorial CMS. It covers the core content types, their validation rules, relationships, and supporting platform requirements.

## Content Types

### Story
- **Primary purpose:** Narrative wrapper for one or more charts and datasets.
- **Fields**
  - `id` (UUID, required, immutable after creation).
  - `slug` (string, required, unique, kebab-case, max 80 chars).
  - `title` (string, required, 10–120 chars).
  - `dek` (string, optional, max 280 chars) – summary sentence used in previews.
  - `body` (rich text JSON, optional) – blocks referencing charts, embeds, and text.
  - `hero_chart_id` (UUID, optional) – must reference a published chart belonging to the story.
  - `topic_ids` (array<UUID>, optional) – references topics; at least one required before publishing.
  - `author_ids` (array<UUID>, required, min length 1).
  - `status` (enum: `draft`, `in_review`, `approved`, `scheduled`, `published`, `archived`).
  - `scheduled_at` (ISO 8601 timestamp, optional) – required when `status` = `scheduled`.
  - `published_at` (ISO 8601 timestamp, system managed) – set when status transitions to `published`.
  - `seo` (object, optional)
    - `title` (string, max 70 chars).
    - `description` (string, max 160 chars).
    - `social_image_asset_id` (UUID, optional).
  - `created_at` / `updated_at` (timestamps, system managed).
- **Validation & rules**
  - Slug uniqueness enforced across all stories.
  - Body blocks referencing charts or datasets must reference records linked to the story.
  - Published stories require at least one topic and one chart (via body blocks or `hero_chart_id`).
- **Relationships**
  - One-to-many with `Chart` via embedded references.
  - Many-to-many with `Topic` and `Author` (Author modeled externally but referenced here).

### Chart
- **Primary purpose:** Visual encodings of datasets; may appear in multiple stories and dashboards.
- **Fields**
  - `id` (UUID, required).
  - `title` (string, required, 5–120 chars).
  - `slug` (string, required, unique per topic, kebab-case).
  - `dataset_id` (UUID, required) – must reference a dataset with `status` ≥ `published`.
  - `viz_spec` (JSON, required) – see [Viz Spec Export Contract](#viz-spec-export-contract).
  - `annotations` (array<object>, optional)
    - `text` (string, required, max 160 chars).
    - `target` (object, required) – coordinate or categorical reference.
  - `status` (enum: `draft`, `in_review`, `approved`, `published`, `deprecated`).
  - `topic_ids` (array<UUID>, optional).
  - `story_ids` (array<UUID>, derived) – populated by referencing stories.
  - `created_at` / `updated_at` (timestamps, system managed).
- **Validation & rules**
  - Charts cannot be published unless linked to an approved dataset.
  - Viz spec must pass JSON schema validation per version.
  - Annotations require both text and target; max 20 annotations per chart.
- **Relationships**
  - Many-to-one with `Dataset`.
  - Many-to-many with `Story` and `Topic`.
  - Optional inclusion in `Dashboard` tiles.

### Dataset
- **Primary purpose:** Structured data feeding charts and dashboards.
- **Fields**
  - `id` (UUID, required).
  - `title` (string, required, 5–160 chars).
  - `slug` (string, required, unique, kebab-case).
  - `source_name` (string, required) – organization or publication.
  - `source_url` (URL, optional but required for external sources).
  - `data_schema` (JSON schema, required) – column descriptions, types, units.
  - `data` (table reference, required) – stored in data warehouse; pointer includes table name + version hash.
  - `refresh_frequency` (enum: `one_time`, `daily`, `weekly`, `monthly`, `quarterly`).
  - `status` (enum: `draft`, `qa`, `published`, `deprecated`).
  - `owner_team_id` (UUID, required) – data stewardship group.
  - `license` (enum or string, optional) – defaults to newsroom standard license.
  - `notes` (rich text, optional).
  - `created_at` / `updated_at` (timestamps).
- **Validation & rules**
  - Data schema must validate against newsroom-approved field types (string, integer, float, date, geo).
  - Published datasets require at least one chart referencing them.
  - Refresh frequency aligns with ETL pipeline scheduling; `one_time` datasets cannot auto-refresh.
- **Relationships**
  - One-to-many with `Chart`.
  - Many-to-many with `Topic` via charts and dashboards.

### Dashboard
- **Primary purpose:** Curated collection of charts and key metrics.
- **Fields**
  - `id` (UUID, required).
  - `slug` (string, required, unique).
  - `title` (string, required, 5–120 chars).
  - `description` (string, optional, max 300 chars).
  - `layout` (array<object>, required) – ordered tiles referencing chart IDs and layout metadata.
  - `filters` (array<object>, optional)
    - Each filter defines `field`, `type` (enum: categorical, numeric, temporal), `default`.
  - `status` (enum: `draft`, `in_review`, `approved`, `published`, `retired`).
  - `visibility` (enum: `internal`, `subscriber`, `public`).
  - `owner_team_id` (UUID, required).
  - `topic_ids` (array<UUID>, optional).
  - `created_at` / `updated_at` (timestamps).
- **Validation & rules**
  - Layout objects must include `chart_id`, `x`, `y`, `w`, `h`, and optional `min_w`/`min_h`.
  - All chart references must be to published charts.
  - Dashboards set to `public` must be reviewed by legal/compliance group (flag in workflow).
- **Relationships**
  - Many-to-many with `Chart` via layout tiles.
  - Many-to-many with `Topic`.
  - Linked to teams for ownership and permissions.

### Topic
- **Primary purpose:** Taxonomy categories unifying stories, charts, datasets, and dashboards.
- **Fields**
  - `id` (UUID, required).
  - `slug` (string, required, unique within taxonomy tree).
  - `name` (string, required, 3–60 chars).
  - `description` (string, optional, max 240 chars).
  - `parent_id` (UUID, optional) – null for root-level topics.
  - `status` (enum: `active`, `inactive`).
  - `created_at` / `updated_at` (timestamps).
- **Validation & rules**
  - Tree depth limited to 3 levels to maintain navigability.
  - `inactive` topics cannot be assigned to new content but remain on historical records.
- **Relationships**
  - Hierarchical self-referential tree.
  - Many-to-many with Story, Chart, Dataset, and Dashboard.

## Realtime Preview Requirements

- **Triggering**
  - Save events in the CMS should emit a preview payload for Story and Chart drafts.
  - Payloads include full story structure with resolved chart previews or isolated chart render data.
- **Transport**
  - WebSocket channel (`/preview`) keyed by draft ID; falls back to Server-Sent Events (SSE) when WebSockets unavailable.
  - Authentication via short-lived preview tokens scoped to user session and draft ID.
- **Rendering**
  - Preview clients must deserialize `viz_spec` for charts and hydrate dataset slices via preview API.
  - Support optimistic updates: UI should reflect local edits while awaiting confirmation.
- **Performance**
  - Target <500ms end-to-end latency for draft updates under normal load.
  - Throttle to 5 updates per second per draft to prevent overload; subsequent updates are coalesced.
- **Failure handling**
  - Fallback to manual refresh when transport unavailable; log and surface non-blocking toast notifications.

## Role-Based Permissions

- **Roles**
  - `Reporter`: create/edit stories and charts in draft; cannot publish.
  - `Editor`: full CRUD on stories/charts, can transition to `approved` or `published`.
  - `Data Analyst`: manage datasets and charts; publish datasets and charts but not stories.
  - `Audience`: view published dashboards/stories; no edit rights.
  - `Admin`: all permissions, including managing roles, topics, and workflow states.
- **Permissions Matrix Highlights**
  - Only Editors and Admins can change story status to `published` or `scheduled`.
  - Dataset publication requires Data Analyst + Editor dual approval (two-step workflow recorded in audit trail).
  - Dashboard visibility changes to `public` require Admin override.
  - Topic creation limited to Admin; reporters can request new topics via workflow comment.

## Workflow Statuses

- **Common transitions**
  - `draft` → `in_review` (Reporter submits for review).
  - `in_review` → `approved` (Editor sign-off).
  - `approved` → `scheduled` (optional, requires publish window).
  - `approved`/`scheduled` → `published` (Editor or Admin executes).
  - `published` → `archived`/`deprecated`/`retired` depending on content type.
- **Validation during transitions**
  - Automatic checks confirm required relationships (e.g., charts have published dataset) before allowing `approved`.
  - Publishing requires all linked records to be in a compatible state (no draft datasets, etc.).
  - Archiving retains references but removes items from public feeds.
- **Audit trail**
  - Every transition records actor, timestamp, and optional note.
  - Webhooks notify Slack/Teams channels for `published` and `archived` events.

## Viz Spec Export Contract

- **Versioning**
  - `viz_spec.version` follows semver (`major.minor.patch`).
  - Breaking schema changes increment `major`; renderer must refuse unsupported majors.
  - Minor versions add optional fields; patch versions include backward-compatible fixes.
- **Envelope**
  ```json
  {
    "version": "1.2.0",
    "chart_type": "line",
    "meta": {
      "title": "Seven-day moving average",
      "description": ""
    },
    "encodings": { ... },
    "data": {
      "dataset_id": "uuid",
      "transform": [ ... ]
    },
    "options": {
      "theme": "light",
      "interactions": {
        "tooltip": true,
        "highlight": "series"
      }
    }
  }
  ```
- **Required keys**
  - `version` (string, required).
  - `chart_type` (enum, required) – see compatible chart types.
  - `encodings` (object, required) – fields vary by chart type but must satisfy shared encoding schema.
  - `data` (object, required)
    - `dataset_id` (UUID, required).
    - `transform` (array, optional) – validated against transform DSL.
  - `options` (object, optional) – theming and interaction hints.
  - `meta` (object, optional) – human-readable context.
- **Compatible chart types**
  - `line`, `area`, `bar`, `stacked_bar`, `grouped_bar`, `scatter`, `bubble`, `pie`, `donut`, `histogram`, `heatmap`, `choropleth`, `table`.
  - Charts requiring geospatial encoding (`choropleth`, `heatmap`) must include `encodings.geo` block with geometry reference.
  - Table chart type expects `encodings.columns` array and optional `sortable` flag.
- **Validation**
  - JSON schema stored alongside renderer; charts fail validation if unknown chart_type or missing encoding requirements.
  - Renderer should log and ignore optional fields it does not recognize.
  - Exported spec must be deterministic; fields ordered and transforms hashed to ensure cache hits.

## Appendix: Relationship Diagram (Conceptual)

```
Topic <---> Story <----> Chart <----> Dataset
   ^          ^  ^          ^
   |          |  |          |
   |          |  +----------+
   |          |             \
   +----------+--------------> Dashboard
```

