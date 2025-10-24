if (
  typeof process !== "undefined" &&
  process.stdout &&
  (!process.stdout.columns || !Number.isFinite(process.stdout.columns))
) {
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
