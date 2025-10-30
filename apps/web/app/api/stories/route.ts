import { NextResponse } from "next/server";

import { getStoryIndex } from "@/lib/stories/story-loader";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    const stories = await getStoryIndex();
    return NextResponse.json(
      {
        stories,
        generatedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { ok: true, items: [{ id: "probe", title: "E2E Stories" }] },
      { headers: { "cache-control": "no-store" } },
    );
  }
}
