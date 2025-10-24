import { test, expect } from "@playwright/test";

test.describe("Cookie attributes", () => {
  test("sv_id from middleware has expected attributes", async ({ page, context }) => {
    await context.clearCookies();
    const resp = await page.goto("/api/dev/sv?id=random");
    expect(resp?.status()).toBe(200);
    const set = resp?.headers()["set-cookie"];
    const origin = new URL(resp?.url() ?? page.url()).origin;
    const cookies = await context.cookies([origin]);
    const sv = cookies.find((c) => c.name === "sv_id");
    expect(sv).toBeTruthy();
    if (set) {
      expect(set).toContain("sv_id=");
      expect(set).toContain("Path=/");
      expect(set.toLowerCase()).toContain("samesite=lax");
      if (process.env.NODE_ENV === "production") {
        expect(set).toMatch(/;\s*Secure/i);
      } else {
        expect(set).not.toMatch(/;\s*Secure/i);
      }
    }
    expect(sv?.path).toBe("/");
    expect(sv?.sameSite?.toLowerCase?.() ?? "").toContain("lax");
    if (typeof sv?.httpOnly === "boolean") expect(sv?.httpOnly).toBe(false);
    if (!set) {
      if (process.env.NODE_ENV === "production") {
        expect(sv?.secure ?? false).toBe(true);
      } else {
        expect(sv?.secure ?? false).toBe(false);
      }
    }
  });

  test("sv_flags_override from /api/ff-override has expected attributes", async ({ page }) => {
    const resp = await page.goto("/api/ff-override?ff=betaUI:true");
    expect(resp?.status()).toBe(200);
    const headers = resp?.headers() || {};
    const set = headers["set-cookie"];
    await page.waitForLoadState("networkidle");
    const origin = new URL(resp?.url() ?? page.url()).origin;
    const cookies = await page.context().cookies([origin]);
    const over = cookies.find((c) => c.name === "sv_flags_override");
    expect(over).toBeTruthy();
    if (set) {
      expect(set).toContain("sv_flags_override=");
      expect(set).toContain("Path=/");
      expect(set.toLowerCase()).toContain("samesite=lax");
      if (process.env.NODE_ENV === "production") {
        expect(set).toMatch(/;\s*Secure/i);
      } else {
        expect(set).not.toMatch(/;\s*Secure/i);
      }
    } else {
      expect(over?.path).toBe("/");
      expect(over?.sameSite?.toLowerCase?.() ?? "").toContain("lax");
      if (process.env.NODE_ENV === "production") {
        expect(over?.secure ?? false).toBe(true);
      } else {
        expect(over?.secure ?? false).toBe(false);
      }
    }
  });
});
