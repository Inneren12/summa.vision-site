import "server-only";

import { authorizeApi } from "@/lib/admin/rbac";
import { handleFlag } from "@/lib/ff/http/core";
import { nextResponseFromCore, requestFromNext } from "@/lib/ff/http/next";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { key: string } }) {
  const auth = authorizeApi(req, "viewer");
  if (!auth.ok) return auth.response;
  const result = await handleFlag(requestFromNext(req), params.key);
  return auth.apply(nextResponseFromCore(result));
}
