import {
  defineConfig,
  devices,
  type PlaywrightTestConfig,
  type WebServerConfig,
} from "@playwright/test";

import baseConfig from "./playwright.config";

const base = baseConfig as PlaywrightTestConfig;
const baseWebServerConfig = Array.isArray(base.webServer) ? base.webServer[0] : base.webServer;
const remainingWebServers =
  Array.isArray(base.webServer) && base.webServer.length > 1 ? base.webServer.slice(1) : undefined;

const resolvedCommand = process.env.PW_WEB_COMMAND || baseWebServerConfig?.command;
const resolvedPort = process.env.PW_WEB_PORT
  ? Number(process.env.PW_WEB_PORT)
  : typeof baseWebServerConfig?.port === "number"
    ? baseWebServerConfig.port
    : undefined;
const resolvedUrl =
  process.env.PW_WEB_URL || (resolvedPort === undefined ? baseWebServerConfig?.url : undefined);

const env = {
  ...(baseWebServerConfig?.env ?? {}),
  NODE_ENV: "development",
  NEXT_RUNTIME: "nodejs",
  FEATURE_FLAGS_LOCAL_PATH: "config/feature-flags.e2e.json",
  NEXT_PUBLIC_DEV_TOOLS: "true",
  FF_TELEMETRY_SINK: "memory",
};

const primaryServer: WebServerConfig = baseWebServerConfig
  ? {
      ...baseWebServerConfig,
      command: resolvedCommand || baseWebServerConfig.command,
      reuseExistingServer:
        baseWebServerConfig.reuseExistingServer !== undefined
          ? baseWebServerConfig.reuseExistingServer
          : !process.env.CI,
      timeout: baseWebServerConfig.timeout ?? 120_000,
      env,
    }
  : {
      command: resolvedCommand || "npm run dev",
      port: resolvedPort ?? Number(process.env.PW_WEB_PORT || "3000"),
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env,
    };

if (resolvedPort !== undefined) {
  primaryServer.port = resolvedPort;
  if (resolvedUrl === undefined) {
    delete (primaryServer as { url?: string }).url;
  }
}

if (resolvedUrl !== undefined) {
  primaryServer.url = resolvedUrl;
}

const webServer: PlaywrightTestConfig["webServer"] = baseWebServerConfig
  ? remainingWebServers
    ? [primaryServer, ...remainingWebServers]
    : primaryServer
  : primaryServer;

// Flags suite: testMatch is relative to testDir, so keep it simple.
export default defineConfig({
  ...base,
  testDir: "./tests/e2e/flags",
  testMatch: ["**/*.spec.ts"],
  webServer,
  use: {
    ...base.use,
    baseURL: process.env.PW_BASE_URL || "http://localhost:3000",
  },
  projects: base.projects ?? [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
