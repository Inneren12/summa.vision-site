import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const deleteOverridesByUser = vi.fn(async () => 0);

vi.mock("@/lib/ff/runtime", () => ({
  FF: () => ({
    store: {
      deleteOverridesByUser,
    },
  }),
}));

describe("POST /api/privacy/erase", () => {
  let tmpDir: string;
  let erasureFile: string;
  let vitalsFile: string;
  let errorsFile: string;
  let telemetryFile: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "privacy-erase-route-"));
    erasureFile = path.join(tmpDir, "privacy.erasure.ndjson");
    vitalsFile = path.join(tmpDir, "vitals.ndjson");
    errorsFile = path.join(tmpDir, "errors.ndjson");
    telemetryFile = path.join(tmpDir, "telemetry.ndjson");
    process.env.PRIVACY_ERASURE_FILE = erasureFile;
    process.env.METRICS_VITALS_FILE = vitalsFile;
    process.env.METRICS_ERRORS_FILE = errorsFile;
    process.env.TELEMETRY_FILE = telemetryFile;
    deleteOverridesByUser.mockReset();
  });

  afterEach(async () => {
    delete process.env.PRIVACY_ERASURE_FILE;
    delete process.env.METRICS_VITALS_FILE;
    delete process.env.METRICS_ERRORS_FILE;
    delete process.env.TELEMETRY_FILE;
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("allows self-service erasure using cookies", async () => {
    await writeFile(
      vitalsFile,
      [
        { sid: "sid-self", metric: "INP", value: 100 },
        { sid: "sid-other", metric: "INP", value: 200 },
      ]
        .map((entry) => JSON.stringify(entry))
        .join("\n") + "\n",
      "utf8",
    );
    await writeFile(errorsFile, "", "utf8");
    await writeFile(
      telemetryFile,
      [
        { userId: "user-self", flag: "test", value: true },
        { userId: "user-other", flag: "test", value: false },
      ]
        .map((entry) => JSON.stringify(entry))
        .join("\n") + "\n",
      "utf8",
    );

    const { POST } = await import("@/app/api/privacy/erase/route");
    const request = new Request("http://localhost/api/privacy/erase", {
      method: "POST",
      headers: {
        cookie: "sv_id=sid-self; ff_aid=aid-self",
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.identifiers).toEqual({ sid: "sid-self", aid: "aid-self", userId: undefined });
    expect(deleteOverridesByUser).not.toHaveBeenCalled();

    const setCookieHeader = response.headers.get("set-cookie") ?? "";
    expect(setCookieHeader).toContain("sv_id=");

    const erasureLog = await readFile(erasureFile, "utf8");
    expect(erasureLog).toMatch(/sid-self/);

    const vitalsContent = await readFile(vitalsFile, "utf8");
    expect(vitalsContent).not.toContain("sid-self");
  });

  it("allows admin erasure by userId and logs overrides", async () => {
    const logModule = await import("@/lib/ff/audit");
    const logSpy = vi.spyOn(logModule, "logAdminAction");
    deleteOverridesByUser.mockResolvedValueOnce(3);

    await writeFile(vitalsFile, "", "utf8");
    await writeFile(errorsFile, "", "utf8");
    await writeFile(telemetryFile, "", "utf8");

    const { POST } = await import("@/app/api/privacy/erase/route");
    const request = new Request("http://localhost/api/privacy/erase", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ff-console-role": "admin",
      },
      body: JSON.stringify({ userId: "user-42", sid: "sid-42" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.identifiers).toEqual({ sid: "sid-42", aid: undefined, userId: "user-42" });
    expect(payload.overridesRemoved).toBe(3);
    expect(deleteOverridesByUser).toHaveBeenCalledWith("user-42");
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "privacy_erase",
        actor: "admin",
        identifiers: { sid: "sid-42", aid: undefined, userId: "user-42" },
        removedOverrides: 3,
      }),
    );
    logSpy.mockRestore();
  });
});
