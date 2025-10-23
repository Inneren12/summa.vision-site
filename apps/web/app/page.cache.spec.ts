import { expect, describe, it } from "vitest";

import * as mod from "./page";

describe("Home ISR", () => {
  it("exports revalidate=300", () => {
    const revalidate = (mod as { revalidate?: number }).revalidate;

    expect(revalidate).toBe(300);
  });
});
