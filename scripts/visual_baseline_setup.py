#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Visual baseline one-shot (Windows-friendly, ASCII-only logs).

Что делает:
- Создаёт apps/web/.env.local, если нет (чтобы next build не падал на /healthz/sitemap).
- Ставит deps (npm ci) и собирает проект (npm run web:build).
- Если есть apps/web/.next/standalone/server.js → используем standalone.
  Иначе fallback на "npm --workspace apps/web run start".
- Находит свободный порт (3010+), генерит локальный конфиг .playwright.visual.local.config.ts
  с webServer.env/cwd (Windows-safe).
- Ставит браузер playwright@1.48.0, гоняет раннер @playwright/test@1.48.0 с --update-snapshots.
- Печатает пути созданных PNG, что добавить в git.

Запуск:
  python scripts/visual_baseline_setup.py
"""

import os
import sys
import subprocess
import socket
from pathlib import Path
from textwrap import dedent

ROOT = Path(__file__).resolve().parents[1]  # scripts/... -> repo root
APP_DIR = ROOT / "apps" / "web"
NEXT_STANDALONE = APP_DIR / ".next" / "standalone" / "server.js"
ENV_LOCAL = APP_DIR / ".env.local"
VISUAL_DIR = ROOT / "e2e" / "visual"
LOCAL_PW_CONFIG = ROOT / ".playwright.visual.local.config.ts"

RUNNER_VERSION = "1.48.0"     # @playwright/test
BROWSERS_VERSION = "1.48.0"   # playwright

def run(cmd, cwd=None, env=None):
    print("> " + cmd)
    proc = subprocess.Popen(
        cmd, cwd=str(cwd or ROOT), env=env or os.environ.copy(),
        shell=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
    )
    for line in proc.stdout:
        sys.stdout.write(line)
    proc.wait()
    if proc.returncode != 0:
        raise RuntimeError("Command failed (%s): %s" % (proc.returncode, cmd))

def port_free(start=3010, limit=50):
    for p in range(start, start + limit):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                s.bind(("127.0.0.1", p))
                return p
            except OSError:
                continue
    raise RuntimeError("No free port found")

def ensure_env_local():
    ENV_LOCAL.parent.mkdir(parents=True, exist_ok=True)
    if ENV_LOCAL.exists():
        print("[OK] %s exists" % ENV_LOCAL)
        return
    ENV_LOCAL.write_text(dedent("""\
        NEXT_PUBLIC_APP_NAME=Summa Vision
        NEXT_PUBLIC_API_BASE_URL=https://example.invalid
        NEXT_PUBLIC_SITE_URL=http://localhost:3000
    """), encoding="utf-8")
    print("[OK] Created %s" % ENV_LOCAL)

def ensure_visual_specs():
    if VISUAL_DIR.exists():
        print("[OK] %s exists" % VISUAL_DIR)
        return
    VISUAL_DIR.mkdir(parents=True, exist_ok=True)
    (VISUAL_DIR / "home.spec.ts").write_text(dedent("""\
        import { test, expect } from "@playwright/test";
        test("home matches baseline", async ({ page }) => {
          await page.goto("/");
          await page.waitForLoadState("networkidle");
          await expect(page).toHaveScreenshot("home.png", { maxDiffPixelRatio: 0.01 });
        });
    """), encoding="utf-8")
    (VISUAL_DIR / "healthz.spec.ts").write_text(dedent("""\
        import { test, expect } from "@playwright/test";
        test("healthz matches baseline", async ({ page }) => {
          await page.goto("/healthz");
          await page.waitForLoadState("networkidle");
          await expect(page).toHaveScreenshot("healthz.png", { maxDiffPixelRatio: 0.01 });
        });
    """), encoding="utf-8")
    (VISUAL_DIR / "atoms.spec.ts").write_text(dedent("""\
        import { test, expect } from "@playwright/test";
        test("atoms matches baseline", async ({ page }) => {
          await page.goto("/atoms");
          await page.waitForLoadState("networkidle");
          await expect(page).toHaveScreenshot("atoms.png", { maxDiffPixelRatio: 0.01 });
        });
    """), encoding="utf-8")
    print("[OK] Created minimal visual specs in %s" % VISUAL_DIR)

def write_local_pw_config(port: int, use_standalone: bool):
    url = "http://localhost:%d" % port
    content = dedent(f"""\
        import {{ defineConfig }} from "@playwright/test";
        export default defineConfig({{
          testDir: "./e2e/visual",
          // Визуальные тесты ожидают, что сервер запущен отдельно.
          webServer: undefined,
          use: {{
            baseURL: "{url}",
            headless: true,
            trace: "retain-on-failure"
          }},
          retries: 0
        }});
    """)
    LOCAL_PW_CONFIG.write_text(content, encoding="utf-8")
    print("[OK] Wrote %s (port=%d, standalone=%s)" % (LOCAL_PW_CONFIG, port, str(use_standalone)))

def main():
    # sanity
    if not (ROOT / "package.json").exists():
        print("[FAIL] package.json not found in repo root")
        sys.exit(2)
    if not APP_DIR.exists():
        print("[FAIL] apps/web not found")
        sys.exit(2)

    # 1) ENV для Next
    ensure_env_local()

    # 2) deps
    try:
        run("npm ci")
    except Exception:
        print("[WARN] npm ci failed, trying npm install ...")
        run("npm install --no-audit --no-fund")

    # 3) build Next
    run("npm run web:build")

    # 4) standalone or fallback
    use_standalone = NEXT_STANDALONE.exists()
    if use_standalone:
        print("[OK] Found standalone: %s" % NEXT_STANDALONE)
    else:
        print("[WARN] Standalone not found. Will run 'npm --workspace apps/web run start' via Playwright.")

    # 5) choose port
    port = port_free(3010, 50)
    print("[OK] Using port %d" % port)

    # 6) ensure specs
    ensure_visual_specs()

    # 7) local Playwright config
    write_local_pw_config(port, use_standalone)

    # 8) install browsers (exact version)
    run(f"npx --yes playwright@{BROWSERS_VERSION} install --with-deps chromium")

    # 9) run runner (exact version) with local config
    run(f"npx --yes @playwright/test@{RUNNER_VERSION} test -c ./{LOCAL_PW_CONFIG.name} --update-snapshots")

    # 10) list created PNG
    created = sorted([str(p) for p in VISUAL_DIR.glob("**/*-snapshots/*.png")])
    if created:
        print("\n[OK] PNG baseline created:")
        for p in created:
            print("  " + p)
        print("\nNext steps:")
        print("  git add e2e/visual/**-snapshots/*.png")
        print('  git commit -m "test(visual): add baseline snapshots"')
        print("  git push")
    else:
        print("\n[WARN] No PNG found in e2e/visual/**-snapshots/*.png; check test output above.")

if __name__ == "__main__":
    try:
        main()
        print("\nSUCCESS")
    except Exception as e:
        try:
            print("\nFAILED: %s" % e)
        except Exception:
            # last-resort ASCII print
            sys.stdout.buffer.write(("\nFAILED: %s\n" % e).encode("ascii", "ignore"))
        sys.exit(1)
