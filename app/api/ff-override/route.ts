import "server-only";

import { handleOverride } from "@/lib/ff/http/core";
import { nextResponseFromCore, requestFromNext } from "@/lib/ff/http/next";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const result = await handleOverride(requestFromNext(req));
  return nextResponseFromCore(result);
}
