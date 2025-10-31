import fs from "node:fs";
import path from "node:path";

export interface BuildWebServerOptions {
  webDir?: string;
  port?: number;
  host?: string;
  healthPath?: string;
  additionalEnv?: Record<string, string | undefined>;
}

export interface BuiltWebServerMeta {
  webDir: string;
  serverJs: string | null;
  usingStandalone: boolean;
  baseUrl: string;
  healthUrl: string;
  port: number;
  host: string;
}

export interface BuiltWebServer {
  config: {
    command: string;
    port: number;
    url: string;
    reuseExistingServer: boolean;
    timeout: number;
    cwd: string;
    env: Record<string, string>;
  };
  meta: BuiltWebServerMeta;
}

export function buildWebServer(options: BuildWebServerOptions = {}): BuiltWebServer {
  const webDir = path.resolve(process.cwd(), options.webDir ?? "apps/web");
  const port = Number(options.port ?? process.env.E2E_PORT ?? process.env.PORT ?? 3000);
  const host = String(options.host ?? process.env.E2E_HOST ?? "127.0.0.1");
  const baseUrl = `http://${host}:${port}`;
  const healthPath = options.healthPath ?? "/api/healthz";
  const healthUrl = `${baseUrl}${healthPath}`;

  const modernStandalone = path.join(webDir, ".next", "standalone", "server.js");
  const monoStandalone = path.join(webDir, ".next", "standalone", "apps", "web", "server.js");

  const hasModern = fs.existsSync(modernStandalone);
  const hasMono = fs.existsSync(monoStandalone);
  const serverJs = hasModern ? modernStandalone : hasMono ? monoStandalone : null;

  const forceStandalone = process.env.PW_USE_STANDALONE === "1";
  const allowStandalone = !process.env.FORCE_NEXT_START;
  const usingStandalone = (!!serverJs && allowStandalone) || (forceStandalone && !!serverJs);

  const command =
    usingStandalone && serverJs
      ? `node ${JSON.stringify(serverJs)}`
      : `npx -y next@14.2.8 start -p ${port}`;

  const cwd = usingStandalone && serverJs ? path.dirname(serverJs) : webDir;

  const env: Record<string, string> = {
    NEXT_E2E: process.env.NEXT_E2E ?? "1",
    NEXT_PUBLIC_MSW: process.env.NEXT_PUBLIC_MSW ?? "1",
    SV_E2E: process.env.SV_E2E ?? "1",
    SV_ALLOW_DEV_API: process.env.SV_ALLOW_DEV_API ?? "1",
    NEXT_PUBLIC_E2E: process.env.NEXT_PUBLIC_E2E ?? "1",
    NEXT_PUBLIC_DEV_TOOLS: process.env.NEXT_PUBLIC_DEV_TOOLS ?? "true",
    NEXT_PUBLIC_FLAGS_ENV: process.env.NEXT_PUBLIC_FLAGS_ENV ?? "dev",
    FF_TELEMETRY_SINK: process.env.FF_TELEMETRY_SINK ?? "memory",
    PORT: String(port),
    HOSTNAME: host,
    ...Object.fromEntries(
      Object.entries(options.additionalEnv ?? {}).filter(([, value]) => value !== undefined),
    ),
  };

  const config = {
    command,
    port,
    url: healthUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    cwd,
    env,
  } as const;

  if (!config.port || !config.url) {
    throw new Error(
      `[webServer] invalid config: ${JSON.stringify({ port: config.port, url: config.url })}`,
    );
  }

  return {
    config,
    meta: {
      webDir,
      serverJs,
      usingStandalone: usingStandalone && !!serverJs,
      baseUrl,
      healthUrl,
      port,
      host,
    },
  };
}
