import { setupWorker } from "msw/browser";

import { handlers } from "./handlers";

declare global {
  interface Window {
    __mswStart?: () => Promise<void>;
    __mswReady?: boolean;
  }
}

const worker = setupWorker(...handlers);

async function startWorker() {
  if (typeof window === "undefined") {
    return;
  }
  if (window.__mswReady) {
    return;
  }

  await worker.start({ onUnhandledRequest: "bypass" });
  window.__mswReady = true;
}

if (typeof window !== "undefined") {
  window.__mswStart = startWorker;
}
