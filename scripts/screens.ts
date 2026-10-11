/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/** Current-source UI acceptance: system Chromium against vite preview. OWNER: module:web. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright-core';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const outArg = process.argv.indexOf('--out');
const OUT = join(ROOT, outArg > 0 ? (process.argv[outArg + 1] as string) : 'runs/screens');
const PORT = 4173;
const CHROMIUM = ['/usr/bin/chromium', '/usr/sbin/chromium', '/usr/bin/chromium-browser'].find(existsSync);
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'phone', width: 390, height: 844, mobile: true },
  { name: 'phone-360', width: 360, height: 780, mobile: true },
] as const;

async function audit(page: Page, errors: string[]): Promise<void> {
  assert.deepEqual(errors, [], 'page errors');
  assert.equal(await page.locator('.error').count(), 0, 'worker error');
  const result = await page.evaluate(() => {
    const controls = [...document.querySelectorAll<HTMLElement>('button, select, summary, input, [role="tab"]')];
    const small = controls.flatMap((el) => {
      if (getComputedStyle(el).visibility === 'hidden' || !el.getClientRects().length) return [];
      const r = el.getBoundingClientRect();
      return r.width < 43.9 || r.height < 43.9
        ? [`${el.textContent?.trim().slice(0, 60)}: ${r.width}×${r.height}`]
        : [];
    });
    const overflows = [
      document.documentElement,
      document.body,
      ...document.querySelectorAll<HTMLElement>('.paper, .sheet-body, .tabs, .bottom-bar'),
    ]
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => `${el.tagName}.${el.className}: ${el.scrollWidth}/${el.clientWidth}`);
    return { small, overflows };
  });
  assert.deepEqual(result.overflows, [], 'horizontal overflow');
  assert.deepEqual(result.small, [], 'controls smaller than 44×44');
}

async function clock(page: Page): Promise<number> {
  return Number(await page.getByTestId('clock').getAttribute('data-time'));
}

async function capture(page: Page, name: string, errors: string[]): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await audit(page, errors);
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  console.log(`screens: ${path}`);
}

async function main(): Promise<void> {
  assert(CHROMIUM, 'no system Chromium found');
  assert(existsSync(join(ROOT, 'apps/web/dist/index.html')), 'run pnpm -C apps/web run build first');
  mkdirSync(OUT, { recursive: true });
  const server = spawn(
    process.execPath,
    [
      join(ROOT, 'apps/web/node_modules/vite/bin/vite.js'),
      'preview',
      '--host',
      '127.0.0.1',
      '--port',
      String(PORT),
      '--strictPort',
    ],
    { cwd: join(ROOT, 'apps/web'), stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let serverLog = '';
  server.stdout.on('data', (d: Buffer) => {
    serverLog += d.toString();
  });
  server.stderr.on('data', (d: Buffer) => {
    serverLog += d.toString();
  });
  const url = `http://127.0.0.1:${PORT}/`;
  try {
    const until = Date.now() + 15_000;
    let up = false;
    while (Date.now() < until) {
      if (server.exitCode !== null) throw new Error(`vite preview exited (${server.exitCode}): ${serverLog}`);
      try {
        if ((await fetch(url)).ok) {
          up = true;
          break;
        }
      } catch {
        /* server starting */
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    assert(up, `preview did not start: ${serverLog}`);
    const browser = await chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox'] });
    try {
      for (const vp of VIEWPORTS) {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          isMobile: vp.mobile,
          hasTouch: vp.mobile,
          deviceScaleFactor: vp.mobile ? 2 : 1,
          ...(vp.mobile
            ? {
                userAgent:
                  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
              }
            : {}),
        });
        const page = await context.newPage();
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(url);
        await page.getByTestId('settlement').waitFor({ timeout: 20_000 });
        await page.locator('.site-canvas').waitFor();
        await page.waitForLoadState('networkidle');
        const initial = await clock(page);
        await page.getByRole('button', { name: '+1h', exact: true }).click();
        await page.waitForFunction(
          (t) => Number(document.querySelector('[data-testid="clock"]')?.getAttribute('data-time')) === t + 60,
          initial,
        );
        const paused = await clock(page);
        await page.waitForTimeout(650);
        assert.equal(await clock(page), paused, 'pause must stop advancement');
        // Speeds are tested with sheets closed so pocket reading policy does not clamp them.
        for (const speed of ['1× speed', '2× speed', '3× speed']) {
          await page.getByRole('button', { name: speed, exact: true }).click();
          assert.equal(
            await page.getByRole('button', { name: speed, exact: true }).getAttribute('aria-pressed'),
            'true',
          );
        }
        await page.getByRole('button', { name: 'Ultra', exact: true }).click();
        await page.waitForFunction(
          (t) => Number(document.querySelector('[data-testid="clock"]')?.getAttribute('data-time')) > t,
          paused,
        );
        await page.getByRole('button', { name: 'Pause', exact: true }).click();
        await page.waitForTimeout(200);
        const stopped = await clock(page);
        await page.waitForTimeout(650);
        assert.equal(await clock(page), stopped, 'pause after Ultra');
        if (vp.mobile) await capture(page, `${vp.name}-map`, errors);
        await page.getByRole('button', { name: 'People', exact: true }).click();
        await page.locator('button[data-player="true"]').click();
        await page.getByTestId('dossier').waitFor();
        await page.getByRole('tab', { name: 'Mind', exact: true }).click();
        await capture(page, vp.mobile ? `${vp.name}-dossier` : vp.name, errors);
        for (const tab of ['Needs', 'Opinions', 'Memories & Beliefs']) {
          await page.getByRole('tab', { name: tab, exact: true }).click();
          await audit(page, errors);
        }
        await page.getByRole('tab', { name: 'Pack / Pantry', exact: true }).click();
        await page.getByTestId('dossier').getByTestId('kit-sheet').waitFor();
        await page.locator('.dossier .readiness').waitFor();
        await capture(page, vp.mobile ? vp.name : `${vp.name}-pack`, errors);
        if (vp.mobile) {
          await page.getByRole('button', { name: 'Expand', exact: true }).click();
          await capture(page, `${vp.name}-pack`, errors);
          await page.getByRole('button', { name: 'Half', exact: true }).click();
        }
        await page.getByRole('button', { name: 'Chronicle', exact: true }).click();
        await capture(page, `${vp.name}-chronicle`, errors);
        // Verify the deployed service worker actually owns this page, then cold-start offline.
        await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 20_000 });
        const manifest = await page.evaluate(async () => {
          const href = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href;
          if (!href) return null;
          return (await (await fetch(href)).json()) as { display: string; icons: Array<{ sizes: string }> };
        });
        assert.equal(manifest?.display, 'standalone');
        assert(manifest.icons.some((i: { sizes: string }) => i.sizes === '192x192'));
        await context.setOffline(true);
        await page.reload();
        await page.getByTestId('settlement').waitFor({ timeout: 20_000 });
        await page.locator('.site-canvas').waitFor();
        const offlineTime = await clock(page);
        await page.getByRole('button', { name: '+1h', exact: true }).click();
        await page.waitForFunction(
          (t) => Number(document.querySelector('[data-testid="clock"]')?.getAttribute('data-time')) === t + 60,
          offlineTime,
        );
        await audit(page, errors);
        console.log(`screens: ${vp.name} controls, time, panels and offline worker passed`);
        await context.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
    server.kill();
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exitCode = 1;
});
