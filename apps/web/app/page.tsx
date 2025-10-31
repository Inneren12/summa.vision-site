import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { cookies } from "next/headers";

import { Container } from "@/components/Container";
import { Link } from "@/components/Link";
import { Text } from "@/components/Text";
import { gatePercent, parseOverridesCookie } from "@/lib/flags/eval";
import { buildMetadata, jsonLd, siteMeta } from "@/lib/seo";

const E2EFlagsProbeClient = dynamic(() => import("./components/E2EFlagsProbe.client"), {
  ssr: false,
});

export const revalidate = 300;

export const metadata: Metadata = buildMetadata({
  title: `${siteMeta.siteName} — Home`,
  openGraph: {
    title: `${siteMeta.siteName} — Home`,
  },
});

export default function Home() {
  const isE2E =
    process.env.SV_E2E === "1" ||
    process.env.NEXT_PUBLIC_E2E === "1" ||
    process.env.SV_ALLOW_DEV_API === "1";

  let betaSSR = false;
  let newCheckoutSSR = false;

  if (isE2E) {
    const jar = cookies();
    const svId = jar.get("sv_id")?.value ?? "";
    const overrides = parseOverridesCookie(jar.get("sv_flags_override")?.value);
    const useEnvDev = jar.get("sv_use_env")?.value === "dev";
    const betaOverride = overrides.betaUI;
    betaSSR = typeof betaOverride === "boolean" ? betaOverride : useEnvDev;

    const pct = Number.parseInt(process.env.NEXT_PUBLIC_NEWCHECKOUT_PCT || "25", 10);
    const percent = Number.isFinite(pct) ? pct : 25;
    const overrideNewCheckout =
      overrides.newcheckout ?? overrides.newCheckout ?? overrides["new-checkout"];
    if (typeof overrideNewCheckout === "boolean") {
      newCheckoutSSR = overrideNewCheckout;
    } else if (useEnvDev) {
      newCheckoutSSR = true;
    } else {
      newCheckoutSSR = gatePercent({ overrides, id: svId, percent });
    }
  }

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
        {isE2E ? (
          <>
            <div data-testid={betaSSR ? "beta-ssr-on" : "beta-ssr-off"}>
              {betaSSR ? "beta ssr on" : "beta ssr off"}
            </div>
            <div data-testid={newCheckoutSSR ? "newcheckout-ssr-on" : "newcheckout-ssr-off"}>
              {newCheckoutSSR ? "newcheckout ssr on" : "newcheckout ssr off"}
            </div>
            <E2EFlagsProbeClient />
          </>
        ) : null}
      </div>
    </Container>
  );
}
