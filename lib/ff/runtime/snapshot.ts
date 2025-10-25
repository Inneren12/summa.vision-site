import fs from "node:fs";
import path from "node:path";

import type { FlagSnapshot, FlagStore } from "./types";

export function writeSnapshotToFile(snapshot: FlagSnapshot, file: string) {
  const target = path.resolve(file);
  const dir = path.dirname(target);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const payload = JSON.stringify(snapshot, null, 2);
  fs.writeFileSync(target, `${payload}\n`, "utf8");
}

export function readSnapshotFromFile(file: string): FlagSnapshot {
  const target = path.resolve(file);
  const data = fs.readFileSync(target, "utf8");
  const parsed = JSON.parse(data) as FlagSnapshot;
  return {
    flags: parsed.flags ?? [],
    overrides: parsed.overrides ?? [],
  } satisfies FlagSnapshot;
}

export async function restoreSnapshot(store: FlagStore, snapshot: FlagSnapshot) {
  const existing = await store.listFlags();
  for (const flag of existing) {
    await store.removeFlag(flag.key);
  }
  for (const flag of snapshot.flags) {
    await store.putFlag(flag);
  }
  for (const entry of snapshot.overrides) {
    await store.putOverride(entry);
  }
}
