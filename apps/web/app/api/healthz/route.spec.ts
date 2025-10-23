import { describe, it, expect } from "vitest";

import { GET } from "./route";

describe("GET /api/healthz", () => {
  it("returns {status:'ok', ts} and no-store", async () => {
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const json = await res.json();
    expect(json.status).toBe("ok");
    expect(typeof json.ts).toBe("string");
  });
});
