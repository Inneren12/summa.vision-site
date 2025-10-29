import { http, HttpResponse } from "msw";

import storiesFixture from "../fixtures/stories.json";

interface StoryStep {
  id: string;
  title: string;
}

interface StoryFixtureEntry {
  slug: string;
  title: string;
  updatedAt: string;
  country?: string;
  sector?: string[];
  steps?: StoryStep[];
}

interface StoriesFixture {
  items: StoryFixtureEntry[];
}

const stories: StoriesFixture = storiesFixture as StoriesFixture;

// утилита для чтения query
const q = (url: URL, key: string) => url.searchParams.get(key) ?? undefined;
const qa = (url: URL, key: string) => url.searchParams.getAll(key);

function filterStories(url: URL) {
  const slug = q(url, "slug");
  const country = q(url, "country");
  const sector = qa(url, "sector");
  let items = [...stories.items];

  if (slug) items = items.filter((i) => i.slug === slug);
  if (country) items = items.filter((i) => i.country === country);
  if (sector.length) items = items.filter((i) => sector.every((s) => i.sector?.includes(s)));

  // имитация API-ответа для дашборда
  return {
    items,
    updatedAt: items[0]?.updatedAt ?? new Date().toISOString(),
  };
}

// простая синтетическая серия для графиков
function series(url: URL) {
  const seed = Number(q(url, "seed") ?? 1);
  const n = Number(q(url, "n") ?? 12);
  const out = Array.from({ length: n }, (_, i) => ({
    t: i,
    y: Number((Math.sin((i + seed) / 2) * 10 + 20 + (seed % 5)).toFixed(2)),
  }));
  return { series: out };
}

export const handlers = [
  // Ингестинг аналитики
  http.post("/api/ingest", async ({ request }) => {
    const body = await request.json().catch(() => ({}));
    return HttpResponse.json(
      { ok: true, requestId: "test-req", echo: body, clock: 1234567890 },
      { status: 200 },
    );
  }),

  // Истории/датасет дашборда
  http.get("/api/stories", ({ request }) => {
    const url = new URL(request.url);
    return HttpResponse.json(filterStories(url), { status: 200 });
  }),

  // Визуальные данные (серии для графиков)
  http.get(/\/api\/viz\/series.*/, ({ request }) => {
    const url = new URL(request.url);
    return HttpResponse.json(series(url), { status: 200 });
  }),
];
