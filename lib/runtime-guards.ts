export const isServer = () => typeof window === "undefined";
export const isClient = () => !isServer();

export function assertServer(hint?: string): void {
  if (!isServer()) {
    throw new Error(
      hint
        ? `Server-only code executed on the client: ${hint}`
        : "Server-only code executed on the client",
    );
  }
}

export function assertClient(hint?: string): void {
  if (!isClient()) {
    throw new Error(
      hint
        ? `Client-only code executed on the server: ${hint}`
        : "Client-only code executed on the server",
    );
  }
}

/** NEXT_RUNTIME: "edge" | "nodejs" */
export function isEdgeRuntime(): boolean {
  return typeof process !== "undefined" && !!process.env && process.env.NEXT_RUNTIME === "edge";
}

export function assertNodeRuntime(hint?: string): void {
  if (isEdgeRuntime()) {
    throw new Error(
      hint
        ? `This code requires the Node.js runtime (not Edge): ${hint}`
        : "This code requires the Node.js runtime (not Edge).",
    );
  }
}
