import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

describe("error boundary + sentry", () => {
  it("captures exception on mount", async () => {
    const error = new Error("boom");
    const [{ default: ErrorBoundary }, sentry] = await Promise.all([
      import("./error"),
      vi.importMock<typeof import("@sentry/nextjs")>("@sentry/nextjs"),
    ]);

    render(<ErrorBoundary error={error} reset={() => {}} />);

    await waitFor(() => {
      expect(sentry.captureException).toHaveBeenCalledWith(error);
    });
  });
});
