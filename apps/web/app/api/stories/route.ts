import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return NextResponse.json(
    { ok: true, items: [{ id: "probe", title: "E2E Stories" }] },
    { headers: { "cache-control": "no-store" } },
  );
}
