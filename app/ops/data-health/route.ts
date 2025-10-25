import "server-only";

import { NextResponse } from "next/server";

import { authorizeApi } from "@/lib/admin/rbac";
import { readDataHealthSummary } from "@/lib/data-health/report";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = authorizeApi(req, "viewer");
  if (!auth.ok) return auth.response;

  const summary = await readDataHealthSummary();
  return auth.apply(NextResponse.json(summary));
}
