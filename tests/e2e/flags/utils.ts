import fs from "node:fs/promises";
import path from "node:path";

export const FLAGS_LOCAL_PATH =
  process.env.FEATURE_FLAGS_LOCAL_PATH || "config/feature-flags.e2e.json";

export async function writeLocalFlags(obj: Record<string, unknown>) {
  const filePath = path.resolve(FLAGS_LOCAL_PATH);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(obj), "utf8");
}

export async function clearLocalFlags() {
  await writeLocalFlags({});
}
