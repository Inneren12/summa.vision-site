import "server-only";

import { handleExposure } from "@/lib/ff/http/core";
import { nextResponseFromCore, requestFromNext } from "@/lib/ff/http/next";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const result = await handleExposure(requestFromNext(req));
  return nextResponseFromCore(result);
}
