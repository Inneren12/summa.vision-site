import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureException = vi.fn();
const getClient = vi.fn();
const getCurrentHub = vi.fn(() => ({ getClient }));

vi.mock("@sentry/nextjs", () => ({
  captureException,
  getCurrentHub,
}));

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  captureException.mockClear();
  getClient.mockReset();
});

describe("error boundary + sentry", () => {
  it("captures exception when Sentry client is configured", async () => {
    const error = new Error("boom");
    getClient.mockReturnValueOnce({});

    const { default: ErrorBoundary } = await import("./error");

    render(<ErrorBoundary error={error} reset={() => {}} />);

    await waitFor(() => {
      expect(captureException).toHaveBeenCalledWith(error);
    });
  });

  it("skips capture when Sentry client is unavailable", async () => {
    const error = new Error("boom");
    getClient.mockReturnValueOnce(undefined);

    const { default: ErrorBoundary } = await import("./error");

    render(<ErrorBoundary error={error} reset={() => {}} />);

    await waitFor(() => {
      expect(captureException).not.toHaveBeenCalled();
    });
  });
});
