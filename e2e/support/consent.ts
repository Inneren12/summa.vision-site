import { expect, type Page } from "../fixtures";

const CONSENT_COOKIE_NAME = "sv_klaro";
const CONSENT_STATE = { analytics: true, vitals: true, share: true } as const;
const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
const FALLBACK_BASE_URL = "http://localhost:3010";

export async function acceptKlaroConsent(page: Page): Promise<void> {
  const cookieUrl = resolveCookieUrl(page);
  const expiresAt = Math.floor(Date.now() / 1000) + CONSENT_MAX_AGE_SECONDS;

  await page.context().addCookies([
    {
      name: CONSENT_COOKIE_NAME,
      value: encodeURIComponent(JSON.stringify(CONSENT_STATE)),
      url: cookieUrl,
      expires: expiresAt,
      sameSite: "Lax",
    },
    {
      name: "sv_consent",
      value: "all",
      url: cookieUrl,
      expires: expiresAt,
      sameSite: "Lax",
    },
  ]);

  const banner = page.locator("#klaro-cookie-notice");
  const acceptButton = banner.locator(".cm-btn-success");

  await Promise.race([
    acceptButton.waitFor({ state: "visible", timeout: 3_000 }),
    banner.waitFor({ state: "hidden", timeout: 3_000 }),
  ]).catch(() => undefined);

  if (!(await banner.isVisible().catch(() => false))) {
    return;
  }

  if (await acceptButton.isVisible().catch(() => false)) {
    await Promise.all([
      page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined),
      acceptButton.click(),
    ]);
  }

  await expect(banner).toBeHidden({ timeout: 5_000 });
}

function resolveCookieUrl(page: Page): string {
  const url = page.url();
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  const contextOptions = page.context() as unknown as {
    _options?: { baseURL?: string };
  };
  const baseURL = contextOptions._options?.baseURL;
  return baseURL ?? FALLBACK_BASE_URL;
}
