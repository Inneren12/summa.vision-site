import type { Metadata } from "next";

import { env } from "./env";
import { SITE, canonical } from "./seo/site";

export const siteMeta = {
  siteName: env.NEXT_PUBLIC_APP_NAME,
  siteUrl: SITE.host,
  defaultTitle: env.NEXT_PUBLIC_APP_NAME,
  defaultDescription: "Site baseline",
};

export function buildMetadata(partial?: Partial<Metadata>): Metadata {
  const base: Metadata = {
    metadataBase: SITE.baseUrl,
    title: siteMeta.defaultTitle,
    description: siteMeta.defaultDescription,
    alternates: {
      canonical: canonical("/"),
    },
    openGraph: {
      siteName: siteMeta.siteName,
      url: canonical("/"),
      title: siteMeta.defaultTitle,
      description: siteMeta.defaultDescription,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
    },
  };

  const metadata: Metadata = {
    ...base,
    ...partial,
    alternates: {
      ...base.alternates,
      ...partial?.alternates,
    },
    openGraph: {
      ...base.openGraph,
      ...partial?.openGraph,
    },
    twitter: {
      ...base.twitter,
      ...partial?.twitter,
    },
  };

  const resolvedTitle = typeof metadata.title === "string" ? metadata.title : siteMeta.defaultTitle;
  const resolvedDescription = metadata.description ?? siteMeta.defaultDescription;

  metadata.alternates = {
    canonical: canonical("/"),
    ...metadata.alternates,
  };

  const openGraph = {
    ...metadata.openGraph,
  } as NonNullable<Metadata["openGraph"]>;
  openGraph.siteName = partial?.openGraph?.siteName ?? siteMeta.siteName;
  openGraph.url = partial?.openGraph?.url ?? canonical("/");
  openGraph.title = partial?.openGraph?.title ?? resolvedTitle;
  openGraph.description = partial?.openGraph?.description ?? resolvedDescription;
  metadata.openGraph = openGraph;

  const twitter = {
    ...metadata.twitter,
  } as NonNullable<Metadata["twitter"]>;
  twitter.title = partial?.twitter?.title ?? resolvedTitle;
  twitter.description = partial?.twitter?.description ?? resolvedDescription;
  metadata.twitter = twitter;

  return metadata;
}

export function jsonLd(thing: Record<string, unknown>) {
  return { __html: JSON.stringify(thing) };
}
