import "server-only";

import { authorizeApi } from "@/lib/admin/rbac";
import { handleFlags } from "@/lib/ff/http/core";
import { nextResponseFromCore, requestFromNext } from "@/lib/ff/http/next";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = authorizeApi(req, "viewer");
  if (!auth.ok) return auth.response;
  const result = await handleFlags(requestFromNext(req));
  return auth.apply(nextResponseFromCore(result));
}

export async function POST(req: Request) {
  const auth = authorizeApi(req, "admin");
  if (!auth.ok) return auth.response;
  const result = await handleFlags(requestFromNext(req));
  return auth.apply(nextResponseFromCore(result));
}
