import { describe, expect, it } from "vitest";

import { hasDoNotTrackEnabled, readConsent, redact } from "@/lib/metrics/privacy";

describe("metrics privacy guard", () => {
  it("prefers the x-consent header over the cookie and defaults to necessary", () => {
    const headerPreferred = new Headers({
      "x-consent": "all",
      cookie: "sv_consent=necessary",
    });
    expect(readConsent(headerPreferred)).toBe("all");

    const cookieFallback = new Headers({ cookie: "sv_consent=all" });
    expect(readConsent(cookieFallback)).toBe("all");

    const missingConsent = new Headers();
    expect(readConsent(missingConsent)).toBe("necessary");
  });

  it("redacts attribution down to the allow list when consent is limited", () => {
    const result = redact({
      eventType: "click",
      eventTarget: "#cta",
      timeToFirstByte: 125,
      resourceLoadDelay: 0.5,
      nested: { eventType: "scroll" },
      url: "https://example.com/private",
      loadState: null,
    });

    expect(result).toEqual({
      eventType: "click",
      timeToFirstByte: 125,
      resourceLoadDelay: 0.5,
    });
  });

  it("detects DNT from any supported header", () => {
    expect(
      hasDoNotTrackEnabled(
        new Headers({
          dnt: "1",
        }),
      ),
    ).toBe(true);

    expect(
      hasDoNotTrackEnabled(
        new Headers({
          "sec-gpc": "1",
        }),
      ),
    ).toBe(true);

    expect(
      hasDoNotTrackEnabled(
        new Headers({
          "x-do-not-track": "yes",
        }),
      ),
    ).toBe(true);

    expect(hasDoNotTrackEnabled(new Headers())).toBe(false);
  });
});
