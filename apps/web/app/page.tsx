import type { Metadata } from "next";

import { Container } from "@/components/Container";
import { Link } from "@/components/Link";
import { Text } from "@/components/Text";
import { buildMetadata, jsonLd, siteMeta } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: `${siteMeta.siteName} — Home`,
  openGraph: {
    title: `${siteMeta.siteName} — Home`,
  },
});

export default function Home() {
  return (
    <Container>
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold text-fg">{siteMeta.siteName}</h1>
        <Text className="text-lg text-muted">
          Baseline is up. See <Link href="/healthz">/healthz</Link>.
        </Text>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLd({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: siteMeta.siteName,
            url: siteMeta.siteUrl,
          })}
        />
      </div>
    </Container>
  );
}
