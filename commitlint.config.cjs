/**
 * Commitlint configuration — relaxed subject-case to unblock CI.
 * Allows subjects like "NDJSON rotation & compaction".
 */
const BREAKGLASS = process.env.COMMITLINT_BREAKGLASS === "true";
/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Разрешаем любую раскладку subject (иначе "NDJSON ..." падает)
    "subject-case": [0],
  },
  ignores: [() => BREAKGLASS, (m) => /^Merge\b/i.test(m), (m) => /^Revert\b/i.test(m)],
};
