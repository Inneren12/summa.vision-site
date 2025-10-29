import { NextResponse } from "next/server";

import { getStoryIndex } from "@/lib/stories/story-loader";

export async function GET(): Promise<Response> {
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
}
