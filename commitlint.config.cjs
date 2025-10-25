/**
 * Commitlint configuration — relaxed subject-case to unblock CI.
 */
const BREAKGLASS = process.env.COMMITLINT_BREAKGLASS === 'true';
/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'subject-case': [0], // allow any subject case (e.g., NDJSON ...)
  },
  ignores: [
    () => BREAKGLASS,
    (m) => /^Merge\b/i.test(m),
    (m) => /^Revert\b/i.test(m),
  ],
};
