const DEFAULT_HOST = "https://example.com" as const;

function resolveHost(value?: string | null) {
  if (!value) {
    return DEFAULT_HOST;
  }

  try {
    return new URL(value).origin;
  } catch {
    return DEFAULT_HOST;
  }
}

const host = resolveHost(process.env.NEXT_PUBLIC_SITE_URL);

export const SITE = {
  host,
  baseUrl: new URL(host),
  locales: ["en", "ru"] as const,
  defaultLocale: "en" as const,
};

export type SiteLocale = (typeof SITE.locales)[number];

export function absoluteUrl(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, SITE.baseUrl).toString();
}

export function canonical(path = "/", locale?: SiteLocale) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  let localizedPath = normalizedPath;

  if (locale && locale !== SITE.defaultLocale) {
    const localePrefix = `/${locale}`;
    if (normalizedPath === "/") {
      localizedPath = localePrefix;
    } else if (!normalizedPath.startsWith(localePrefix)) {
      localizedPath = `${localePrefix}${normalizedPath}`;
    }
  }

  return absoluteUrl(localizedPath);
}
