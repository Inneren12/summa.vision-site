import { describe, it, expect } from "vitest";

import * as routeModule from "./route";

describe("GET /api/healthz", () => {
  it("returns ok json payload", async () => {
    const response = await routeModule.GET();

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toMatchObject({ ok: true });
    expect(typeof json.ts).toBe("number");
  });
});
