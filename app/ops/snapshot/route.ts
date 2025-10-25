import "server-only";

import { NextResponse } from "next/server";

import { authorizeApi } from "@/lib/admin/rbac";
import { FF } from "@/lib/ff/runtime";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = authorizeApi(req, "ops");
  if (!auth.ok) return auth.response;
  const { store } = FF();
  const snapshot = await store.snapshot();
  return auth.apply(NextResponse.json(snapshot));
}
