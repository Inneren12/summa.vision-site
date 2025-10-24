import "server-only";

import fs from "node:fs/promises";

import { NextResponse } from "next/server";

import { authorizeApi } from "@/lib/admin/rbac";

const DEFAULT_TELEMETRY_FILE = "./.runtime/telemetry.ndjson";

function buildCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    if (value === null || typeof value === "undefined") return "";
    const str = String(value).replace(/"/g, '""');
    if (/[",\n]/.test(str)) return `"${str}"`;
    return str;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((key) => escape(row[key])).join(","));
  }
  return lines.join("\n");
}

function parseTelemetry(ndjson: string): Record<string, unknown>[] {
  return ndjson
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as Record<string, unknown>;
      } catch {
        return {} as Record<string, unknown>;
      }
    })
    .filter((row) => Object.keys(row).length > 0);
}

export async function GET(req: Request) {
  const auth = authorizeApi(req, "viewer");
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const fmt = (url.searchParams.get("fmt") || "ndjson").toLowerCase();
  const file = process.env.TELEMETRY_FILE || DEFAULT_TELEMETRY_FILE;
  let content = "";
  try {
    content = await fs.readFile(file, "utf8");
  } catch {
    content = "";
  }
  if (fmt === "csv") {
    const rows = parseTelemetry(content);
    const csv = buildCsv(rows);
    const res = new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
      },
    });
    return auth.apply(res);
  }
  const res = new NextResponse(content, {
    status: 200,
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
    },
  });
  return auth.apply(res);
}
