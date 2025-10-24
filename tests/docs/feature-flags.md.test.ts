import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, it, expect } from 'vitest';

const DOC_PATH = path.join(process.cwd(), 'docs', 'feature-flags.md');

function loadDoc(): string {
  return readFileSync(DOC_PATH, 'utf8');
}

describe('docs/feature-flags.md completeness', () => {
  const doc = loadDoc();
  const mustHave = [
    'Источники и приоритеты',
    'Формат флагов',
    'Таблица приоритетов',
    'Cookie‑лимиты',
    'WARNING про salt',
    'Где вызывать getFlagsServer()',
    'Rollout Playbook',
    'Troubleshooting Guide',
    'Privacy',
    'Будущее (S3+)'
  ];

  for (const section of mustHave) {
    it(`contains section: ${section}`, () => {
      expect(doc).toContain(section);
    });
  }
});
