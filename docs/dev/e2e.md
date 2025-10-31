# Playwright E2E: local setup

## CI vs. local: why `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` works in CI

Our CI runners already have Google Chrome installed system-wide. When we run Playwright
projects that specify `channel: 'chrome'` (for example `desktop-chrome`), Playwright just
reuses that Chrome binary. Because of that, the CI workflow can safely set
`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` to avoid downloading any extra browsers and still pass
all checks.

On a fresh local machine the Playwright-managed browsers are usually **not** present yet.
If you keep `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` locally, Playwright is not allowed to
fetch Chrome/Chromium on demand, so it fails with the error:

```
Error: The Chromium binary is not installed in the environment
```

To fix local runs you have three options depending on your preference.

## Option A — allow Playwright to install its browsers

This is the most straightforward approach and works everywhere.

<details>
<summary>Windows PowerShell</summary>

```powershell
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=$null
npx -y @playwright/test@1.48.0 install chrome
# If you also need bundled Chromium for other projects:
# npx -y @playwright/test@1.48.0 install chromium
```

</details>

<details>
<summary>Git Bash / WSL / Linux</summary>

```bash
unset PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD
npx -y @playwright/test@1.48.0 install --with-deps chromium
# Or, if you specifically want the system Chrome-managed channel:
npx -y @playwright/test@1.48.0 install chrome
```

</details>

> `npx -y … install` only downloads the browsers; it does **not** change `package.json`
> or the lockfile.

## Option B — keep `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` and use system Chrome

If you already have Google Chrome installed (and available in `PATH`), you can reuse it.
Keep the environment variable and run tests by explicitly selecting the Chrome channel:

```bash
PW_CHANNEL=chrome PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
  npx -y @playwright/test@1.48.0 test -c ./playwright.config.ts \
  e2e/visual/healthz.spec.ts --project=desktop-chrome --reporter=dot --retries=0
```

If the run still fails, it means some configuration tries to launch the default
`chromium` build (without a channel). In that case prefer Option A, which guarantees the
binary exists.

## Option C — one-off “ephemeral” installation

Need a quick fix without changing your environment variables? Install the required
browser once per machine:

```bash
npx -y @playwright/test@1.48.0 install chromium
```

This command re-enables Playwright’s managed Chromium without touching project manifests.

## Quick checklist

1. Decide whether you want to download Playwright-managed browsers (Option A/C) or use
   your system Chrome (Option B).
2. Run the appropriate commands above.
3. Repeat your Playwright test command — the error about the missing Chromium binary
   should disappear.

Once at least one browser is installed locally, the usual `npm run e2e` / targeted
Playwright commands will succeed just like they do in CI.
