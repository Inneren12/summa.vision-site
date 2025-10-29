import fs from "node:fs/promises";

import { test as base } from "@playwright/test";
import type { ConsoleMessage } from "@playwright/test";

const LOG_FILE_NAME = "browser-console.log";
const ERROR_LOG_FILE_NAME = "browser-console-errors.log";

function formatLocation(url: string | undefined, line?: number, column?: number): string {
  if (!url) {
    return "";
  }

  const parts: Array<string | number> = [];
  if (typeof line === "number") {
    parts.push(line);
  }
  if (typeof column === "number") {
    parts.push(column);
  }

  const suffix = parts.length ? `:${parts.join(":")}` : "";
  return `${url}${suffix}`;
}

function formatMessage({
  text,
  type,
  url,
  lineNumber,
  columnNumber,
}: {
  text: string;
  type: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
}): string {
  const timestamp = new Date().toISOString();
  const location = formatLocation(url, lineNumber, columnNumber);
  const locationSuffix = location ? ` (${location})` : "";
  return `[${timestamp}] [${type}] ${text}${locationSuffix}`;
}

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const consoleLogEntries: string[] = [];
    const errorLogEntries: string[] = [];

    const handleConsole = (message: ConsoleMessage) => {
      const type = message.type();
      const text = message.text();
      const location = message.location();
      const formatted = formatMessage({
        text,
        type,
        url: location?.url,
        lineNumber: location?.lineNumber,
        columnNumber: location?.columnNumber,
      });

      consoleLogEntries.push(formatted);
      if (type === "error" || type === "warning") {
        errorLogEntries.push(formatted);
      }
    };

    page.on("console", handleConsole);

    try {
      await use(page);
    } finally {
      page.off("console", handleConsole);

      await Promise.all([
        (async () => {
          if (consoleLogEntries.length === 0) {
            return;
          }
          try {
            const logPath = testInfo.outputPath(LOG_FILE_NAME);
            await fs.writeFile(logPath, `${consoleLogEntries.join("\n")}\n`, "utf8");
            await testInfo.attach(LOG_FILE_NAME, {
              path: logPath,
              contentType: "text/plain",
            });
          } catch (error) {
            console.warn("Не удалось записать лог консоли браузера", error);
          }
        })(),
        (async () => {
          if (errorLogEntries.length === 0) {
            return;
          }
          try {
            const errorLogPath = testInfo.outputPath(ERROR_LOG_FILE_NAME);
            await fs.writeFile(errorLogPath, `${errorLogEntries.join("\n")}\n`, "utf8");
            await testInfo.attach(ERROR_LOG_FILE_NAME, {
              path: errorLogPath,
              contentType: "text/plain",
            });
            console.log(
              `Browser console captured ${errorLogEntries.length} warnings/errors. See attachment ${ERROR_LOG_FILE_NAME}.`,
            );
          } catch (error) {
            console.warn("Не удалось записать лог ошибок консоли браузера", error);
          }
        })(),
      ]);
    }
  },
});

export const expect = test.expect;
export type { Page, APIRequestContext, APIResponse, Locator } from "@playwright/test";
