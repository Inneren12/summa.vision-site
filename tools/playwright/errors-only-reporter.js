/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require("fs");
const path = require("path");

class ErrorsOnlyReporter {
  constructor(options = {}) {
    this.outputFile = options.outputFile || "test-results/errors.log";
    this.entries = [];
  }

  onTestEnd(test, result) {
    if (result.status === "passed" || result.status === "skipped") return;

    const loc = test.location ? `${test.location.file}:${test.location.line}` : "";
    const title = test.titlePath().join(" › ");
    const err = result.error;
    const msg = err ? err.message || String(err) : `status=${result.status}`;
    const stack = err && err.stack ? err.stack : "";

    this.entries.push(
      [
        "=== FAIL ================================================================",
        title,
        loc ? `at ${loc}` : "",
        "",
        msg,
        stack,
        "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  onEnd() {
    if (!this.entries.length) return;

    const dir = path.dirname(this.outputFile);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.outputFile, this.entries.join("\n"), "utf8");
    console.log(
      `[errors-only-reporter] wrote ${this.outputFile} (${this.entries.length} failure(s))`,
    );
  }
}

module.exports = ErrorsOnlyReporter;
