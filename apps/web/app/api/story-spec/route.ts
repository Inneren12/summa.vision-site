import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

type ErrorBody = { error: string };

const STORIES_DIR = path.join(process.cwd(), "content", "stories");

function buildError(status: number, message: string) {
  return NextResponse.json<ErrorBody>({ error: message }, { status });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawPath = url.searchParams.get("path");

  if (!rawPath) {
    return buildError(400, "Missing spec path");
  }

  if (rawPath.includes("\0")) {
    return buildError(400, "Invalid spec path");
  }

  const normalized = rawPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const absolutePath = path.resolve(STORIES_DIR, normalized);
  const relative = path.relative(STORIES_DIR, absolutePath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return buildError(400, "Spec path must stay within stories directory");
  }

  try {
    const contents = await fs.readFile(absolutePath, "utf8");
    try {
      const parsed = JSON.parse(contents);
      return NextResponse.json(parsed, {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      return buildError(422, "Spec file is not valid JSON");
    }
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return buildError(404, "Spec file not found");
      }
    }
    throw error;
  }
}
