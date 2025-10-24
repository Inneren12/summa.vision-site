/**
 * Доп. ESLint-конфиг для границы server→client.
 *
 * Не ломает существующий .eslintrc.*; запускать отдельно при необходимости.
 *
 * Блокирует импорт server-модулей из client-компонентов.
 */
module.exports = {
  root: false,
  overrides: [
    {
      files: ["**/*.client.ts", "**/*.client.tsx"],
      rules: {
        // Запрещаем тянуть server-модули и маркер server-only в клиент
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              "**/lib/**/server",
              "**/lib/**/server/**",
              "**/lib/env.server",
              "**/lib/env.server/**",
              "server-only",
            ],
          },
        ],
      },
    },
  ],
};
