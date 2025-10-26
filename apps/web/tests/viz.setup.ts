import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();

  const maybeGc = (globalThis as typeof globalThis & { gc?: () => void }).gc;
  if (typeof maybeGc === "function") {
    maybeGc();
  }

  vi.clearAllMocks();
});
