import { describe, it, expect } from "vitest";

import { GET } from "./route";

describe("GET /api/healthz", () => {
  it("returns compatible body and no-store", async () => {
    const response = await GET();

    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const json = await response.json();
    expect(json.status).toBe("ok");
    expect(json.ok).toBe(true);
    expect(typeof json.ts).toBe("string");
  });
});
