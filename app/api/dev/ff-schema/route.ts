import "server-only";
import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env/load";
import { validateFeatureFlagsEnvString } from "@/lib/ff/schema";

export const runtime = "nodejs";

export async function GET() {
  if (!getEnv().NEXT_PUBLIC_DEV_TOOLS) {
    return NextResponse.json({ error: "Dev tools disabled" }, { status: 404 });
  }
  const report = validateFeatureFlagsEnvString(process.env.FEATURE_FLAGS_JSON);
  return NextResponse.json(
    { ok: report.ok, errors: report.errors, warnings: report.warnings },
    { status: 200 },
  );
}
