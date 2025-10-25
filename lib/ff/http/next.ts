import { cookies as nextCookies } from "next/headers";
import { NextResponse } from "next/server";

import type { CoreResponse, RequestLike } from "./types";

export function requestFromNext(req: Request): RequestLike {
  let cookieStore: ReturnType<typeof nextCookies> | null = null;
  try {
    cookieStore = nextCookies();
  } catch {
    cookieStore = null;
  }
  const headerCookies = req.headers.get("cookie") ?? "";
  return {
    method: req.method,
    url: req.url,
    headers: {
      get(name: string) {
        const value = req.headers.get(name);
        return value ?? null;
      },
    },
    cookies: {
      get(name: string) {
        if (cookieStore) {
          return cookieStore.get(name)?.value;
        }
        if (!headerCookies) return undefined;
        const parts = headerCookies.split(/;\s*/);
        for (const part of parts) {
          if (!part) continue;
          const [cookieName, ...rest] = part.split("=");
          if (cookieName && cookieName === name) {
            return rest.join("=");
          }
        }
        return undefined;
      },
    },
    json: () => req.json(),
    text: () => req.text(),
  } satisfies RequestLike;
}

export function nextResponseFromCore(result: CoreResponse): NextResponse {
  const response =
    result.kind === "json"
      ? NextResponse.json(result.body, { status: result.status })
      : NextResponse.redirect(result.location, { status: result.status });

  if (result.headers) {
    for (const [key, value] of Object.entries(result.headers)) {
      response.headers.set(key, value);
    }
  }

  if (result.kind === "redirect" && !result.headers?.Location) {
    response.headers.set("Location", result.location);
  }

  if (result.cookies) {
    for (const cookie of result.cookies) {
      const options = (cookie.options ?? {}) as Parameters<typeof response.cookies.set>[2];
      response.cookies.set(cookie.name, cookie.value, options);
    }
  }

  return response;
}
