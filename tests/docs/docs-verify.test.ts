import fs from 'node:fs';

import { describe, it, expect } from 'vitest';

const must = [
  'docs/FLAGS_PLAYBOOK.md',
  'docs/FLAGS_SECURITY_PRIVACY.md',
  'docs/FLAGS_TROUBLESHOOTING.md',
  'docs/FLAGS_GOVERNANCE.md',
  'docs/FLAGS_API_REFERENCE.md',
];

describe('Docs presence & sections', () => {
  it('all core docs exist', () => {
    for (const f of must) {
      expect(fs.existsSync(f)).toBe(true);
    }
  });

  it('playbook has key headings', () => {
    const t = fs.readFileSync('docs/FLAGS_PLAYBOOK.md', 'utf8');
    expect(t).toMatch(/Rollout Playbook/);
    expect(t).toMatch(/Exposure/);
    expect(t).toMatch(/Governance/);
    expect(t).toMatch(/Security/);
  });
});
