import { chromium, type Browser } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const templates = ['chart', 'fact', 'story'] as const;

type TemplateName = (typeof templates)[number];

async function runAxe(template: TemplateName, browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 630 } });
  const page = await context.newPage();
  const templatePath = path.resolve(__dirname, '../og/templates', `${template}.html`);
  await page.goto(pathToFileURL(templatePath).href, { waitUntil: 'networkidle' });

  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  await context.close();
  return { template, results: accessibilityScanResults };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const scans = [];
  for (const template of templates) {
    scans.push(await runAxe(template, browser));
  }
  await browser.close();

  const violations = scans.filter((scan) => scan.results.violations.length > 0);

  if (violations.length > 0) {
    violations.forEach((violation) => {
      // eslint-disable-next-line no-console
      console.error(`Accessibility violations in ${violation.template}:`);
      violation.results.violations.forEach((item) => {
        // eslint-disable-next-line no-console
        console.error(`  ${item.id}: ${item.help}`);
      });
    });
    process.exitCode = 1;
    return;
  }

  // eslint-disable-next-line no-console
  console.log('All OG templates pass axe-core checks.');
}

void main();
