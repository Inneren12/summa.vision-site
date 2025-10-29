import { factory, primaryKey } from "@mswjs/data";
import { http, HttpResponse } from "msw";

import storiesFixture from "../fixtures/stories.json";

type StoriesPayload = typeof storiesFixture;

type VizSeed = {
  slug: string;
  metric: string;
  series: Array<{ x: number; y: number }>;
};

const VIZ_GENERATED_AT = "2024-01-01T00:00:00.000Z";
const INGEST_CLOCK_BASE = 1_708_992_000_000;
const INGEST_CLOCK_STEP = 75;

const db = factory({
  vizSeries: {
    id: primaryKey(String),
    slug: String,
    metric: String,
    series: Array,
  },
  ingestEvent: {
    id: primaryKey(String),
    type: String,
    slug: String,
    stepId: String,
    clock: Number,
  },
});

const vizSeeds: VizSeed[] = [
  {
    slug: "demo",
    metric: "engagement",
    series: [
      { x: 0, y: 0.1 },
      { x: 1, y: 0.35 },
      { x: 2, y: 0.58 },
      { x: 3, y: 0.76 },
    ],
  },
  {
    slug: "analytics",
    metric: "events",
    series: [
      { x: 0, y: 2 },
      { x: 1, y: 5 },
      { x: 2, y: 8 },
    ],
  },
  {
    slug: "reduced-motion",
    metric: "visits",
    series: [
      { x: 0, y: 10 },
      { x: 1, y: 10 },
      { x: 2, y: 10 },
    ],
  },
];

vizSeeds.forEach((seed) => {
  db.vizSeries.create({
    id: `${seed.slug}:${seed.metric}`,
    slug: seed.slug,
    metric: seed.metric,
    series: seed.series.map((point) => ({ ...point })),
  });
});

type RecordedEvent = {
  id: string;
  type: string;
  clock: number;
  stepId: string | null;
  slug: string | null;
  payload: unknown;
};

function computeSignature(events: unknown[]): number {
  const input = JSON.stringify(events ?? []);
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) % 1_000_000;
  }
  return hash;
}

function recordEvents(events: unknown[], slug: string | null, seed: number): RecordedEvent[] {
  const baseClock = INGEST_CLOCK_BASE + seed * 10;
  return events.map((event, index) => {
    const id = `evt-${seed.toString().padStart(6, "0")}-${(index + 1).toString().padStart(2, "0")}`;
    const type =
      event &&
      typeof event === "object" &&
      "type" in event &&
      typeof (event as { type: unknown }).type === "string"
        ? (event as { type: string }).type
        : "unknown";
    const stepId =
      event &&
      typeof event === "object" &&
      "stepId" in event &&
      typeof (event as { stepId: unknown }).stepId === "string"
        ? (event as { stepId: string }).stepId
        : null;
    const slugFromEvent =
      event &&
      typeof event === "object" &&
      "slug" in event &&
      typeof (event as { slug: unknown }).slug === "string"
        ? (event as { slug: string }).slug
        : null;
    const clock = baseClock + (index + 1) * INGEST_CLOCK_STEP;
    db.ingestEvent.create({
      id,
      type,
      stepId: stepId ?? "",
      slug: slug ?? slugFromEvent ?? "",
      clock,
    });
    return { id, type, clock, stepId, slug: slug ?? slugFromEvent, payload: event };
  });
}

function resolveVizResponse(slug: string, metric?: string | null) {
  const targetMetric = metric ?? undefined;
  const entry = db.vizSeries.findFirst({
    where: {
      slug: { equals: slug },
      ...(targetMetric ? { metric: { equals: targetMetric } } : {}),
    },
  });

  if (!entry) {
    return HttpResponse.json(
      {
        error: `Unknown visualization data for slug "${slug}"`,
      },
      { status: 404 },
    );
  }

  return HttpResponse.json(
    {
      slug: entry.slug,
      metric: entry.metric,
      series: entry.series,
      generatedAt: VIZ_GENERATED_AT,
    },
    { status: 200 },
  );
}

export const handlers = [
  http.post("/api/ingest", async ({ request }) => {
    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }

    const snapshot = typeof body.snapshot === "string" ? body.snapshot : "snapshot-test";
    const events = Array.isArray(body.events) ? (body.events as unknown[]) : [];
    const seed = computeSignature(events);
    const recorded = recordEvents(events, typeof body.slug === "string" ? body.slug : null, seed);

    return HttpResponse.json(
      {
        ok: true,
        requestId: `request-${seed.toString().padStart(6, "0")}`,
        clock: recorded[recorded.length - 1]?.clock ?? INGEST_CLOCK_BASE,
        snapshot,
        events: recorded,
      },
      { status: 200 },
    );
  }),

  http.get("/api/stories", () => {
    return HttpResponse.json<StoriesPayload>(storiesFixture, { status: 200 });
  }),

  http.get("/api/viz/:slug/:metric", ({ params }) => {
    const slug = String(params.slug ?? "");
    const metric = String(params.metric ?? "");
    return resolveVizResponse(slug, metric);
  }),

  http.get("/api/viz/:slug", ({ params, request }) => {
    const slug = String(params.slug ?? "").replace(/\.json$/i, "");
    const metric = new URL(request.url).searchParams.get("metric");
    return resolveVizResponse(slug, metric);
  }),
];
