if (typeof process !== "undefined" && process.stdout) {
  try {
    const stdout = process.stdout as NodeJS.WriteStream & { columns?: number };
    Object.defineProperty(stdout, "columns", {
      configurable: true,
      get: () => 80,
    });
  } catch {
    (process.stdout as NodeJS.WriteStream & { columns?: number }).columns = 80;
  }
}

if (typeof process !== "undefined") {
  process.env.FF_STABLEID_USER_PREFIX ??= "user_";
}

if (typeof globalThis !== "undefined" && globalThis.crypto) {
  const cryptoObj = globalThis.crypto as { randomUUID?: () => string };
  try {
    Object.defineProperty(cryptoObj, "randomUUID", {
      configurable: true,
      writable: true,
      value: () => "anon",
    });
  } catch {
    cryptoObj.randomUUID = () => "anon";
  }
}

if (typeof globalThis !== "undefined" && !("REDACTED_VALUE" in globalThis)) {
  (globalThis as Record<string, unknown>).REDACTED_VALUE = undefined;
}
