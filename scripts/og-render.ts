import { chromium, Browser } from 'playwright';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface RenderOptions {
  template: string;
  theme: 'light' | 'dark';
  data: Record<string, string>;
  output: string;
}

function parseArgs(argv: string[]): RenderOptions {
  const getValue = (flag: string, fallback?: string) => {
    const index = argv.indexOf(flag);
    if (index === -1) {
      return fallback;
    }
    return argv[index + 1];
  };

  const template = getValue('--template');
  if (!template) {
    throw new Error('Missing required --template argument.');
  }

  const theme = (getValue('--theme', 'light') as RenderOptions['theme']) ?? 'light';
  if (!['light', 'dark'].includes(theme)) {
    throw new Error(`Unsupported theme "${theme}". Use "light" or "dark".`);
  }

  const dataInput = getValue('--data', '{}') ?? '{}';
  const output = getValue('--out', path.resolve(process.cwd(), `${template}-${theme}.png`))!;

  return {
    template,
    theme,
    data: parseData(dataInput),
    output: path.resolve(process.cwd(), output),
  };
}

function parseData(input: string): Record<string, string> {
  if (!input) {
    return {};
  }

  try {
    if (input.trim().startsWith('{')) {
      return JSON.parse(input);
    }

    const filePath = path.resolve(process.cwd(), input);
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to parse data payload: ${(error as Error).message}`);
  }
}

async function ensureOutputDir(filepath: string) {
  await fs.mkdir(path.dirname(filepath), { recursive: true });
}

async function render(options: RenderOptions, browser?: Browser) {
  const templatePath = path.resolve(__dirname, '../og/templates', `${options.template}.html`);
  try {
    await fs.access(templatePath);
  } catch (error) {
    throw new Error(`Template not found: ${templatePath}`);
  }

  const templateUrl = pathToFileURL(templatePath).href;
  const localBrowser = browser ?? (await chromium.launch({ headless: true }));
  const context = await localBrowser.newContext({ viewport: { width: 1200, height: 630 } });
  const page = await context.newPage();

  await page.goto(templateUrl, { waitUntil: 'networkidle' });

  await page.evaluate(
    ({ data, theme }) => {
      const root = document.querySelector('.og-canvas');
      if (root) {
        root.setAttribute('data-theme', theme);
      }
      Object.entries(data).forEach(([slot, value]) => {
        document.querySelectorAll(`[data-slot="${slot}"]`).forEach((node) => {
          node.textContent = value;
        });
      });
    },
    { data: options.data, theme: options.theme },
  );

  await ensureOutputDir(options.output);
  await page.screenshot({ path: options.output, type: 'png' });

  await context.close();
  if (!browser) {
    await localBrowser.close();
  }
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const browser = await chromium.launch({ headless: true });
    await render(options, browser);
    await browser.close();
    // eslint-disable-next-line no-console
    console.log(`OG image saved to ${options.output}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
