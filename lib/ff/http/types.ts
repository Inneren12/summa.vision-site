export interface HeadersLike {
  get(name: string): string | null;
}

export interface CookieJarLike {
  get(name: string): string | undefined;
}

export interface RequestLike {
  method: string;
  url: string;
  headers: HeadersLike;
  cookies: CookieJarLike;
  json<T = unknown>(): Promise<T>;
  text(): Promise<string>;
}

export type CookieInitLike = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  path?: string;
  domain?: string;
  maxAge?: number;
};

export type CookieUpdate = {
  name: string;
  value: string;
  options?: CookieInitLike;
};

export type CoreResponse = JsonResponse | RedirectResponse;

export type JsonResponse = {
  kind: "json";
  status: number;
  body: unknown;
  headers?: Record<string, string>;
  cookies?: CookieUpdate[];
};

export type RedirectResponse = {
  kind: "redirect";
  status: number;
  location: string;
  headers?: Record<string, string>;
  cookies?: CookieUpdate[];
};
