import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Healthz from "../../app/(system)/healthz/page";

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
        json: vi.fn().mockResolvedValue({ status: "ok", ts: "2025-01-01T00:00:00.000Z" }),
      }),
    );

    render(await Healthz());

    expect(screen.getByText(/"status":\s*"ok"/)).toBeInTheDocument();
    expect(screen.getByText(/"ts":\s*"2025-01-01T00:00:00.000Z"/)).toBeInTheDocument();
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
