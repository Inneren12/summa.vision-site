import "server-only";

import { NextResponse } from "next/server";

import { authorizeApi } from "@/lib/admin/rbac";
import { FF } from "@/lib/ff/runtime";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { key: string } }) {
  const auth = authorizeApi(req, "viewer");
  if (!auth.ok) return auth.response;
  const key = params.key;
  const store = FF().store;
  const flag = store.getFlag(key);
  if (!flag) {
    return auth.apply(NextResponse.json({ error: `Flag ${key} not found` }, { status: 404 }));
  }
  const overrides = store.listOverrides(key);
  const res = NextResponse.json({ ok: true, flag, overrides });
  return auth.apply(res);
}
