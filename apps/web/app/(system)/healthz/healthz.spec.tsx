import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Healthz from "./page";

const headerValues: Record<string, string> = {
  "x-forwarded-proto": "http",
  host: "localhost:3000",
};

vi.mock("next/headers", () => ({
  headers: () => ({
    get: (key: string) => headerValues[key.toLowerCase()] ?? null,
  }),
}));

describe("/healthz page", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    headerValues.host = "localhost:3000";
    headerValues["x-forwarded-proto"] = "http";
  });

  it("renders the health payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ ok: true, ts: 1_735_680_000_000 }),
      }),
    );

    render(await Healthz());

    expect(screen.getByText(/"ok":\s*true/)).toBeInTheDocument();
    expect(screen.getByText(/"ts":\s*1735680000000/)).toBeInTheDocument();
  });

  it("falls back to null when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn(),
      }),
    );

    render(await Healthz());

    expect(screen.getByText("null")).toBeInTheDocument();
  });
});
