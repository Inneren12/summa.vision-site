import "server-only";

import { NextResponse } from "next/server";

import { authorizeApi } from "@/lib/admin/rbac";
import { logAdminAction } from "@/lib/ff/audit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = authorizeApi(req, "admin");
  if (!auth.ok) return auth.response;
  const json = await req.json().catch(() => ({}));
  const enable = json?.enable === true || json?.enabled === true;
  process.env.FF_KILL_ALL = enable ? "true" : "false";
  logAdminAction({
    timestamp: Date.now(),
    actor: auth.role,
    action: "kill_toggle",
    enabled: process.env.FF_KILL_ALL === "true",
  });
  return auth.apply(NextResponse.json({ ok: true, killAll: process.env.FF_KILL_ALL === "true" }));
}
