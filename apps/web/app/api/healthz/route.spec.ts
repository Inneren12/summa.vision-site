import { describe, it, expect } from "vitest";

import * as routeModule from "./route";

describe("GET /api/healthz", () => {
  it("returns ok json payload", async () => {
    const response = await (routeModule.GET as () => Response)();

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toMatchObject({ status: "ok" });
    expect(typeof json.ts).toBe("string");
    expect(new Date(json.ts).toString()).not.toBe("Invalid Date");
  });
});
