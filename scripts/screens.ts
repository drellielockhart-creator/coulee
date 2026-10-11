/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/** Current-source UI acceptance: system Chromium against vite preview. OWNER: module:web. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type BrowserContext, chromium, type Page } from 'playwright-core';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const OUT = join(ROOT, arg('--out') ?? 'runs/screens');
const PORT = Number(arg('--port') ?? process.env.SCREENS_PORT ?? 4173);
const ONLY = arg('--only');
const CHROMIUM = ['/usr/bin/chromium', '/usr/sbin/chromium', '/usr/bin/chromium-browser'].find(existsSync);
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, mobile: false, layout: 'desk' },
  { name: 'phone', width: 390, height: 844, mobile: true, layout: 'pocket' },
  { name: 'phone-360', width: 360, height: 780, mobile: true, layout: 'pocket' },
  // A phone on its side: coarse pointer, 390 px tall (11 §3.4 / §4.2: Folio, never forced rotation).
  { name: 'landscape', width: 844, height: 390, mobile: true, layout: 'folio' },
] as const;
type Viewport = (typeof VIEWPORTS)[number];

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
    // Book section tabs scroll sideways by design; the dossier's must fit on one row.
    const overflows = [
      document.documentElement,
      document.body,
      ...document.querySelectorAll<HTMLElement>('.paper, .sheet-body, .dossier .tabs, .bottom-bar'),
    ]
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => `${el.tagName}.${el.className}: ${el.scrollWidth}/${el.clientWidth}`);
    // Every time control and rail button must be the topmost element at its own center.
    const covered = [...document.querySelectorAll<HTMLElement>('.bottom-bar button')].flatMap((b) => {
      const r = b.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return top === b || b.contains(top) ? [] : [`${b.textContent?.trim()} under ${top?.tagName}.${top?.className}`];
    });
    return { small, overflows, covered };
  });
  assert.deepEqual(result.overflows, [], 'horizontal overflow');
  assert.deepEqual(result.small, [], 'controls smaller than 44×44');
  assert.deepEqual(result.covered, [], 'time controls covered');
}

async function clock(page: Page): Promise<number> {
  return Number(await page.getByTestId('clock').getAttribute('data-time'));
}

async function stepHour(page: Page): Promise<void> {
  const t = await clock(page);
  await page.getByRole('button', { name: '+1h', exact: true }).click();
  await page.waitForFunction(
    (t0) => Number(document.querySelector('[data-testid="clock"]')?.getAttribute('data-time')) === t0 + 60,
    t,
  );
}

async function capture(page: Page, name: string, errors: string[]): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await audit(page, errors);
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  console.log(`screens: ${path}`);
}

/** Close whatever sheet or drawer is open (pocket/folio). */
async function closeSheet(page: Page): Promise<void> {
  const close = page.getByRole('button', { name: /^Close (sheet|panel)$/ });
  if (await close.count()) await close.first().click();
}

/**
 * Tap the PC's figure on the map with a real touch sequence (CDP), then check the sheet the tap
 * opened is still there 600 ms later: the browser's compatibility click must not land on it.
 */
async function tapPlayer(page: Page, context: BrowserContext, vp: Viewport, errors: string[]): Promise<void> {
  await closeSheet(page);
  // Daytime, so the PC stands outside rather than being a pip on her roof; and let walks finish:
  // the label must hold still before we aim at the figure under it.
  const label = page.locator('.lbl-actor.is-player');
  let lb = await label.boundingBox();
  for (let i = 0; i < 16; i++) {
    for (let k = 0; k < 40; k++) {
      await page.waitForTimeout(250);
      const next = await label.boundingBox();
      const still = lb && next && Math.abs(lb.x - next.x) < 0.5 && Math.abs(lb.y - next.y) < 0.5;
      lb = next;
      if (still && k > 1) break;
    }
    if ((await label.isVisible()) && !/[☾⌂]/.test((await label.textContent()) ?? '')) break;
    await stepHour(page);
  }
  // Dispatches sit over the top of the map: read them, then clear them out of the way.
  while ((await page.locator('.dispatch button').count()) > 0) await page.locator('.dispatch button').first().click();
  lb = await label.boundingBox();
  assert(lb, 'PC label on the map');
  const x = lb.x + lb.width / 2;
  const y = lb.y + lb.height + 12;
  if (vp.mobile) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.click(x, y);
  }
  await page.waitForTimeout(600);
  if (vp.layout !== 'desk') {
    const sheet = page.getByTestId('sheet');
    assert.equal(await sheet.count(), 1, 'a tap on the map leaves its sheet open (no ghost click)');
    if (vp.layout === 'pocket')
      assert.equal(await sheet.getAttribute('data-detent'), 'peek', 'map taps open the peek card first');
  }
  // In a crowd (church on a Sunday) the tap opens the stack chooser; take its first entry.
  const crowd = page.getByTestId('stack');
  const opened = page.locator('[data-testid="peek"], [data-testid="stack"], [data-testid="dossier"]').first();
  try {
    await opened.waitFor({ timeout: 5000 });
  } catch (e) {
    await page.screenshot({ path: join(OUT, `${vp.name}-tap-actor-FAILED.png`) });
    throw e;
  }
  await capture(page, `${vp.name}-tap-actor`, errors);
  if (await crowd.count()) {
    await crowd.getByRole('button').first().click();
    await page.getByTestId('dossier').first().waitFor();
  } else if (vp.layout === 'pocket') {
    await page.getByRole('button', { name: 'More ▴', exact: true }).click();
  }
  if (vp.layout === 'pocket') {
    await page.getByTestId('dossier').waitFor();
    assert.equal(await page.getByTestId('sheet').getAttribute('data-detent'), 'half');
    const m = await page.evaluate(() => {
      const sheet = document.querySelector('.sheet')?.getBoundingClientRect();
      const map = document.querySelector('.map-column')?.getBoundingClientRect();
      const tabs = document.querySelector('.dossier .tabs')?.getBoundingClientRect();
      const body = document.querySelector('.sheet-body')?.getBoundingClientRect();
      const content = document.querySelector('.sheet .tab-content');
      return {
        sheetH: sheet?.height ?? 0,
        mapH: map?.height ?? 1,
        tabsH: tabs?.height ?? 0,
        contentTop: content?.getBoundingClientRect().top ?? 9999,
        bodyBottom: body?.bottom ?? 0,
      };
    });
    assert(m.sheetH / m.mapH < 0.56, `half sheet is about half the map (${m.sheetH}/${m.mapH})`);
    assert(m.tabsH < 64, `dossier tabs fit one row (${m.tabsH}px)`);
    assert(
      m.bodyBottom - m.contentTop > 150,
      `the half sheet shows the tab's content (${m.bodyBottom - m.contentTop}px)`,
    );
    await capture(page, `${vp.name}-dossier-half`, errors);
  }
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
        if (ONLY && !ONLY.split(',').includes(vp.name)) continue;
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
        assert.equal(await page.getByTestId('settlement').getAttribute('data-layout'), vp.layout, 'layout');
        await stepHour(page);
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
        await capture(page, `${vp.name}-map`, errors);
        // The Book is its own panel, opened from the store's place card (the PC is home there at night).
        await page.getByRole('button', { name: 'Places', exact: true }).click();
        await page.locator('.place-row', { hasText: '· store' }).first().click();
        await page.getByTestId('place-card').waitFor();
        await page.getByTestId('place-card').getByRole('button', { name: /Book/ }).click();
        await page.getByTestId('book').waitFor();
        await capture(page, `${vp.name}-book`, errors);
        await tapPlayer(page, context, vp, errors);
        await closeSheet(page);
        await page.getByRole('button', { name: 'People', exact: true }).click();
        await page.locator('button[data-player="true"]').click();
        await page.getByTestId('dossier').first().waitFor();
        await page.getByRole('tab', { name: 'Mind', exact: true }).first().click();
        await capture(page, `${vp.name}-dossier`, errors);
        for (const tab of ['Body', 'Ties', 'Known']) {
          await page.getByRole('tab', { name: tab, exact: true }).first().click();
          await audit(page, errors);
        }
        await page.getByRole('tab', { name: 'Ties', exact: true }).first().click();
        await capture(page, `${vp.name}-ties`, errors);
        await page.getByRole('tab', { name: 'Pack', exact: true }).first().click();
        await page.getByTestId('dossier').first().getByTestId('kit-sheet').waitFor();
        await page.locator('.dossier .readiness').first().waitFor();
        const packH = await page.evaluate(
          () => document.querySelector('.dossier')?.closest('.sheet-body, .inspector, .drawer')?.scrollHeight ?? 0,
        );
        assert(packH < 4000, `Pack tab stays a few screens tall (${packH}px), the Book has its own panel`);
        await capture(page, `${vp.name}-pack`, errors);
        if (vp.layout === 'pocket') {
          await page.getByRole('button', { name: 'Expand sheet', exact: true }).click();
          await capture(page, `${vp.name}-pack-full`, errors);
          await page.getByRole('button', { name: '▾ Half', exact: true }).click();
        }
        await page.getByRole('button', { name: 'Chronicle', exact: true }).click();
        await capture(page, `${vp.name}-chronicle`, errors);
        // God view: Settings only, behind a confirm, and it tags the Chronicle (11 §2.14).
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        await page.getByRole('button', { name: 'God view…', exact: true }).click();
        await capture(page, `${vp.name}-settings`, errors);
        await page.getByRole('button', { name: 'Switch God view on', exact: true }).click();
        await page.getByRole('button', { name: 'Chronicle', exact: true }).click();
        await page.getByText('God view was used this session').first().waitFor();
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        await page.getByRole('button', { name: 'Turn God view off', exact: true }).click();
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
        await stepHour(page);
        await audit(page, errors);
        console.log(`screens: ${vp.name} controls, time, tap, panels and offline worker passed`);
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
