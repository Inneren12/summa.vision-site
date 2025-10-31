import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.SV_ALLOW_DEV_API !== "1" &&
    process.env.NEXT_PUBLIC_E2E !== "1"
  ) {
    return new NextResponse("dev api disabled", { status: 404 });
  }

  const id = req.cookies.get("sv_id")?.value ?? "";
  return NextResponse.json({ id });
}
