import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { POST as snapshotRestore } from "@/app/ops/restore/route";
import { GET as snapshotGet } from "@/app/ops/snapshot/route";
import { __clearAudit, readAuditRecent } from "@/lib/ff/audit";
import { FF, resetFFRuntime } from "@/lib/ff/runtime";

describe("ops snapshot/restore routes", () => {
  let savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv = { ...process.env } as Record<string, string | undefined>;
    for (const key of Object.keys(process.env)) {
      delete (process.env as Record<string, string | undefined>)[key];
    }
    Object.assign(process.env, savedEnv);
    process.env.NODE_ENV = "test";
    process.env.FF_CONSOLE_OPS_TOKENS = "ops-token";
    resetFFRuntime();
    __clearAudit();
  });

  afterEach(() => {
    resetFFRuntime();
    __clearAudit();
    for (const key of Object.keys(process.env)) {
      delete (process.env as Record<string, string | undefined>)[key];
    }
    Object.assign(process.env, savedEnv);
  });

  it("returns the current runtime snapshot", async () => {
    const { store } = FF();
    store.putFlag({
      key: "testFlag",
      namespace: "default",
      version: 1,
      description: "test flag",
      enabled: true,
      kill: false,
      killSwitch: false,
      seedByDefault: "stableId",
      defaultValue: false,
      tags: ["test"],
      rollout: { percent: 0, seedBy: "stableId" },
      segments: [],
      createdAt: 1,
      updatedAt: 1,
    });
    const req = new Request("http://localhost/ops/snapshot", {
      headers: { authorization: "Bearer ops-token" },
    });
    const response = await snapshotGet(req);
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(Array.isArray(payload.flags)).toBe(true);
    expect(payload.flags).toHaveLength(1);
    expect(payload.flags[0].key).toBe("testFlag");
  });

  it("restores snapshot and logs audit entry", async () => {
    const { store } = FF();
    store.putFlag({
      key: "legacy",
      namespace: "default",
      version: 1,
      description: "legacy",
      enabled: true,
      kill: false,
      killSwitch: false,
      seedByDefault: "stableId",
      defaultValue: false,
      tags: [],
      rollout: { percent: 0, seedBy: "stableId" },
      segments: [],
      createdAt: 1,
      updatedAt: 1,
    });
    store.putOverride({
      flag: "legacy",
      scope: { type: "global" },
      value: false,
      updatedAt: 1,
    });

    const snapshot = {
      flags: [
        {
          key: "betaUI",
          namespace: "summa",
          version: 2,
          description: "beta",
          enabled: true,
          kill: false,
          killSwitch: false,
          seedByDefault: "stableId",
          defaultValue: false,
          tags: ["beta"],
          rollout: { percent: 50, seedBy: "stableId", salt: "v1" },
          segments: [],
          createdAt: 10,
          updatedAt: 20,
        },
      ],
      overrides: [
        {
          flag: "betaUI",
          scope: { type: "global" },
          value: true,
          reason: "hotfix",
          updatedAt: 30,
        },
      ],
    };

    const req = new Request("http://localhost/ops/restore", {
      method: "POST",
      headers: { authorization: "Bearer ops-token", "content-type": "application/json" },
      body: JSON.stringify(snapshot),
    });
    const response = await snapshotRestore(req);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.flags).toBe(1);
    expect(body.overrides).toBe(1);

    const flags = await store.listFlags();
    expect(flags).toHaveLength(1);
    expect(flags[0].key).toBe("betaUI");
    expect(await store.listOverrides("betaUI")).toHaveLength(1);

    const audit = readAuditRecent();
    expect(audit.at(-1)).toMatchObject({
      action: "snapshot_restore",
      flags: 1,
      overrides: 1,
    });
  });
});
