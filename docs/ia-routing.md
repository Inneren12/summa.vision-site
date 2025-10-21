# Information Architecture & Routing Overview

## Sitemap Hierarchy
- **Home** (`/`)
  - Hero carousel linking to featured stories and initiatives
  - Topic filters quick-access chips
  - Latest stories feed (`/stories`)
  - Impact metrics (`/impact`)
- **Stories** (`/stories`)
  - Story detail (`/stories/{slug}`)
    - Related stories module
    - Call-to-action banner (donate, subscribe)
  - Stories by topic (`/stories/topic/{topic-slug}`)
  - Stories by region (`/stories/region/{region-slug}`)
- **Initiatives** (`/initiatives`)
  - Initiative detail (`/initiatives/{slug}`)
- **Research & Insights** (`/research`)
  - Publication detail (`/research/{slug}`)
- **About** (`/about`)
  - Leadership (`/about/leadership`)
  - Partners (`/about/partners`)
  - Careers (`/about/careers`)
- **Contact** (`/contact`)
- **Support Us** (`/support`)
- **Press Room** (`/press`)
- **Resources** (`/resources`)
  - Resource detail (`/resources/{slug}`)

### Utility Pages
- **Search results** (`/search?q={query}`)
- **Newsletter signup confirmation** (`/newsletter/thanks`)
- **Legal** (`/legal/privacy`, `/legal/terms`)
- **System** (`/404`, `/500`, `/offline`)

## URL Patterns
| Pattern | Purpose | Notes |
| --- | --- | --- |
| `/stories/{slug}` | Longform editorial content | Slugs derived from title, lowercase with hyphens |
| `/stories/topic/{topic-slug}` | Filtered list of stories | Supports pagination via `?page=` |
| `/stories/region/{region-slug}` | Regional storytelling | Optional `?impact=` filter for metrics |
| `/initiatives/{slug}` | Program or campaign detail | Encourage secondary CTA for donations |
| `/research/{slug}` | Downloadable reports, briefs | Include `?download=pdf` option |
| `/resources/{slug}` | Toolkits, guides, media | Display file metadata |
| `/press/{year}` | Press releases by year | Default to current year |
| `/legal/{doc}` | Compliance documents | `doc` in {`privacy`, `terms`} |
| `/search` | Global search results | Query parameter required |

## Breadcrumb Model
- Home > Section > Detail
  - Example: Home > Stories > _The Future of Sustainable Cities_
- Home > Stories > Topic > Detail
  - Example: Home > Stories > Climate > _Resilient Coastal Communities_
- Home > Research & Insights > Publication
- Home > Resources > Toolkit
- Home > Press Room > Year > Release
- Home > About > Subpage
- Home > Legal > Document

Breadcrumbs should:
1. Use inline separators (`›`).
2. Collapse to the highest-level node on small screens, revealing trail on tap.
3. Surface search results trail as: Home > Search > `{query}`.

## Navigation Wireframes

### Header States
- **Default (desktop)**
  - Left: brand mark linking to `/`.
  - Center: primary nav (`Stories`, `Initiatives`, `Research`, `About`, `Resources`, `Support Us`).
  - Right: search icon (opens overlay), language toggle (EN/ES dropdown), "Donate" button.
  - Secondary row: topic filter rail (horizontally scrollable chips) visible on `/stories` and detail pages.
- **Scrolled**
  - Condensed height, brand mark reduces to monogram.
  - Primary nav collapses to key links (`Stories`, `Research`, `Support`), others move into "More" menu.
  - Search icon persists; language toggle reduces to icon with tooltip.
- **Mobile**
  - Hamburger menu reveals slide-in panel.
  - Panel contains: quick search field, language toggle, primary nav list, topic filters grouped under collapsible accordion.
  - Persistent "Donate" pill anchored in header.

### Footer States
- **Global footer**
  - Column 1: About, Leadership, Careers, Contact.
  - Column 2: Stories, Initiatives, Research, Resources, Press Room.
  - Column 3: Support Us, Newsletter signup form, social links.
  - Utility bar: language toggle, privacy, terms, sitemap download.
- **Micro footer (landing pages)**
  - Compact row with essential links (Support, Contact, Privacy) and language toggle.
  - Optional sticky donate button for campaign pages.

## Search Entry Points & Topic Filters
- Header search icon opens modal with:
  - Suggested queries (top stories, initiatives).
  - Topic quick links.
- Mobile menu search input provides inline suggestions.
- Footer newsletter form offers CTA to "Explore Stories" linking to `/stories`.
- Topic filters appear:
  - On `/stories` list (chips labeled by taxonomy).
  - On detail pages as contextual filter row (defaults to active topic, shows siblings).
  - In slide-in panel within mobile nav.

## Language Toggle Behavior
- Toggle supports EN (default) and ES.
- Switching language reloads current URL with locale prefix (`/es/...`).
- Persist preference via cookie/local storage for 30 days.
- Display toast confirmation: "Ahora estás viendo Summa Vision en Español."/"You’re now viewing Summa Vision in English."

## Fallback Behaviors

### 404 Not Found (`/404`)
- Tone: empathetic, solution-oriented.
- Copy: "We couldn’t find that page, but our latest stories are ready for you."
- Actions: search bar, featured stories carousel, link to `/contact` for assistance.

### 500 Server Error (`/500`)
- Tone: reassuring, transparent.
- Copy: "Something went wrong on our side. We’re working to fix it."
- Actions: primary CTA to return home, secondary CTA to report issue (`/contact`).
- Include system status badge (green/amber/red) when available.

### Empty Filter/No Results
- Applies to `/stories`, `/research`, `/search` when filters yield no content.
- Tone: encouraging discovery.
- Copy: "No matches yet. Try adjusting filters or explore our curated picks."
- Actions: reset filters button, curated content suggestions, link to subscribe for updates.

