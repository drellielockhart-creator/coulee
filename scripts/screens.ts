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
const REGION_ONLY = process.argv.includes('--region');
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
      ...document.querySelectorAll<HTMLElement>('.paper, .sheet-body, .dossier .tabs, .bottom-bar, .play, .storefront'),
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

/** Clear the map's dispatches without acting on them: OK an auto-pause, mark a digest read. */
async function clearDispatches(page: Page): Promise<void> {
  for (let i = 0; i < 8; i++) {
    const done = await page.evaluate(() => {
      const button =
        [...document.querySelectorAll<HTMLButtonElement>('.dispatch.alert button')].find(
          (b) => b.textContent?.trim() === 'OK',
        ) ??
        document.querySelector<HTMLButtonElement>('button[aria-label="Mark as read"]') ??
        document.querySelector<HTMLButtonElement>('button[aria-label="Dismiss the kept journey"]');
      button?.click();
      return !button;
    });
    if (done) return;
    await page.waitForTimeout(150);
  }
}

/** Open a rail panel (Act, Go, Trade, Pack, Ledger), never toggling it shut. */
async function rail(page: Page, label: string): Promise<void> {
  const button = page.locator('.rail').getByRole('button', { name: label, exact: true });
  if ((await button.getAttribute('aria-current')) === 'true') return;
  await button.click();
}

/** Wait for the session's verdict on the last order: the outcome banner names it. */
async function outcomeFor(page: Page, label: string | RegExp): Promise<string> {
  const outcome = page.getByTestId('outcome');
  try {
    await outcome.filter({ hasText: label }).first().waitFor({ timeout: 30_000 });
  } catch (e) {
    await page.screenshot({ path: join(OUT, 'outcome-FAILED.png') });
    console.error(`outcome wanted ${label}; saw: ${await outcome.allTextContents()}`);
    throw e;
  }
  return (await outcome.first().textContent()) ?? '';
}

/** Walk the PC somewhere through the Go menu (an offered `go:` action), and wait for the hour. */
async function goTo(page: Page, place: string): Promise<void> {
  await rail(page, 'Go');
  await page.getByTestId('act-body').waitFor();
  await page.getByRole('searchbox', { name: 'Find a place' }).fill(place);
  await page
    .getByTestId('act-body')
    .getByRole('button', { name: new RegExp(place) })
    .first()
    .click();
  await outcomeFor(page, new RegExp(place));
  await clearDispatches(page);
}

/** Open an Act group (drill-in), from wherever the Act panel is. */
async function actGroup(page: Page, label: RegExp): Promise<void> {
  await rail(page, 'Act');
  const back = page.getByRole('button', { name: '◂ All kinds', exact: true });
  if (await back.count()) await back.click();
  await page.locator('.act-groups').getByRole('button', { name: label }).click();
  await page.getByTestId('act-body').waitFor();
}

/**
 * The play loop (ADR 0002 parity): every button here sends one of the session's own offered
 * actions; the shots show what a player sees at each step.
 */
async function playLoop(page: Page, vp: Viewport, errors: string[]): Promise<void> {
  // The Act menu: situation and the kinds of action on offer.
  await rail(page, 'Act');
  await page.getByTestId('play').waitFor();
  await capture(page, `${vp.name}-act-menu`, errors);

  // A wait that the shared interrupt policy cuts short (ADR 0002 §3): try longer waits until one stops.
  let stopped = false;
  for (const label of ['Till dusk', 'Till nightfall', 'Till dawn', 'Till noon', 'Till dusk', 'Till morning']) {
    await actGroup(page, /Rest & wait/);
    await page.getByTestId('waits').getByRole('button', { name: label, exact: true }).click();
    const text = await outcomeFor(page, label);
    if (/Wait stopped/.test(text)) {
      stopped = true;
      break;
    }
  }
  assert(stopped, 'a long wait stops on an interrupt');
  if (vp.layout === 'pocket') await page.getByTestId('alert').waitFor();
  await capture(page, `${vp.name}-wait-paused`, errors);
  await clearDispatches(page);

  // Walk to the outfitter through the Go menu; wait for the counter to open if need be.
  await goTo(page, 'Pratt & Daughter');
  await rail(page, 'Trade');
  await page.getByTestId('storefront').waitFor();
  for (let i = 0; i < 6 && (await page.locator('.closed-note').count()); i++) {
    await page.locator('.closed-note').getByRole('button').click();
    await page.waitForTimeout(400);
    await clearDispatches(page);
    if ((await page.getByTestId('storefront').count()) === 0) await rail(page, 'Trade');
  }
  assert.equal(await page.locator('.closed-note').count(), 0, 'the counter opens');
  // The Provisions page: compare two foods, then open an order with a preview.
  await page.getByRole('tab', { name: 'Provisions', exact: true }).click();
  const foods = page.locator('.stock-line').filter({ has: page.locator('.food-facts') });
  assert((await foods.count()) >= 2, 'at least two foods for sale');
  await foods.nth(0).getByRole('button', { name: 'Compare', exact: true }).click();
  await foods.nth(1).getByRole('button', { name: 'Compare', exact: true }).click();
  await page.getByRole('button', { name: 'Compare ▸', exact: true }).click();
  await page.getByTestId('compare').waitFor();
  await page.getByTestId('compare').locator('.cell-btn').first().click();
  await capture(page, `${vp.name}-compare`, errors);
  await page.getByRole('button', { name: '◂ Back to the Book', exact: true }).click();
  await page.getByRole('button', { name: 'Clear the comparison', exact: true }).click();
  await foods.nth(0).getByRole('button', { name: 'Buy…', exact: true }).click();
  await page.getByRole('button', { name: 'One more', exact: true }).click();
  await page.getByRole('button', { name: 'One more', exact: true }).click();
  await page.getByTestId('preview').waitFor();
  await page.waitForFunction(() => /→/.test(document.querySelector('[data-testid="preview"]')?.textContent ?? ''));
  // The order whole, under its stock line: quantity, preview, confirm.
  await page.getByTestId('order').evaluate((el) => el.scrollIntoView({ block: 'end' }));
  await capture(page, `${vp.name}-store-preview`, errors);
  // The preview's days of food climbs to its Explain (M4 #5).
  await page.getByTestId('preview-days').getByRole('button').click();
  await page.getByTestId('preview-days').locator('.explain-pop').waitFor();
  await capture(page, `${vp.name}-store-explain`, errors);
  await page
    .getByTestId('order')
    .getByRole('button', { name: /^Buy 3 for/ })
    .click();
  await outcomeFor(page, /^Buy 3/);
  await clearDispatches(page);

  // The Kit Sheet with a food number's Explain open (M4 #5).
  await rail(page, 'Pack');
  const kit = page.getByTestId('kit-sheet').first();
  await kit.getByTestId('days-of-food').getByRole('button').click();
  await kit.locator('.explain-pop').first().waitFor();
  await capture(page, `${vp.name}-kit-explain`, errors);

  // The journal, with what was owed and heard.
  await rail(page, 'Ledger');
  await page.getByRole('tab', { name: 'Journal', exact: true }).click();
  await page.getByTestId('journal').locator('.journal-list, .empty').first().waitFor();
  await page.waitForFunction(
    () => !/Turning the pages/.test(document.querySelector('[data-testid="journal"]')?.textContent ?? ''),
  );
  await capture(page, `${vp.name}-journal`, errors);
  await closeSheet(page);
}

/**
 * Tap the PC's figure on the map with a real touch sequence (CDP), then check the sheet the tap
 * opened is still there 600 ms later: the browser's compatibility click must not land on it.
 */
async function tapPlayer(page: Page, context: BrowserContext, vp: Viewport, errors: string[]): Promise<void> {
  // The newcomer goes only where she is told: out onto the street, where her figure stands.
  await goTo(page, 'Main Street');
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
  await clearDispatches(page);
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

/** The two-site authored fixture, with real map taps and the same offered travel Command. */
async function regionLoop(page: Page, vp: Viewport, errors: string[]): Promise<void> {
  await page.getByRole('button', { name: 'Region', exact: true }).click();
  const map = page.getByTestId('region-map');
  await map.waitFor();
  await capture(page, `${vp.name}-region-start`, errors);
  // Exercise camera controls and a drag; Fit makes the destination tap reproducible.
  const node = map.locator('[data-region-node]').first();
  const initial = await node.boundingBox();
  assert(initial, 'known site label');
  await page.getByRole('button', { name: 'Zoom region in', exact: true }).click();
  const zoomed = await node.boundingBox();
  assert(zoomed && Math.abs(zoomed.x - initial.x) > 1, 'zoom moves the site relative to the camera anchor');
  const bounds = await map.boundingBox();
  assert(bounds, 'region map bounds');
  const x = bounds.x + bounds.width / 2,
    y = bounds.y + bounds.height * 0.55;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 35, y + 20, { steps: 5 });
  await page.mouse.up();
  const dragged = await node.boundingBox();
  assert(dragged && dragged.x > zoomed.x + 25, 'mouse dragging pans the region');
  await map.getByRole('button', { name: 'Fit', exact: true }).click();
  if (vp.mobile) {
    const fitted = await node.boundingBox();
    assert(fitted, 'fitted site label');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: x - 45, y, id: 1 },
        { x: x + 45, y, id: 2 },
      ],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: x - 75, y, id: 1 },
        { x: x + 75, y, id: 2 },
      ],
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
    const pinched = await node.boundingBox();
    assert(pinched && Math.abs(pinched.x - fitted.x) > 1, 'touch pinching zooms the region');
    await map.getByRole('button', { name: 'Fit', exact: true }).click();
  }
  const destination = map.getByRole('button', { name: 'Route to Cedar Farm', exact: true });
  if (vp.mobile) {
    const target = await destination.boundingBox();
    assert(target, 'known destination hit area');
    await page.touchscreen.tap(target.x + target.width / 2, target.y + target.height / 2);
  } else await destination.click();
  const card = page.getByTestId('route-card');
  await card.waitFor();
  await page.waitForFunction(() =>
    /Route to Cedar Farm:/.test(document.querySelector('[data-testid="route-preview"]')?.textContent ?? ''),
  );
  assert.equal(await clock(page), 0, 'the map route query costs no time');
  await capture(page, `${vp.name}-region-route`, errors);
  await card.getByRole('button', { name: 'Depart for Cedar Farm', exact: true }).click();
  await outcomeFor(page, 'Depart for Cedar Farm');
  await closeSheet(page);
  await clearDispatches(page);
  await stepHour(page);
  await clearDispatches(page);
  const position = map.getByTestId('region-position');
  await position.waitFor();
  const progress = Number(await position.getAttribute('data-progress'));
  assert(progress > 0 && progress < 1000, 'PC is partway along the road');
  await capture(page, `${vp.name}-region-mid-journey`, errors);
  // Site/region stays available on the road; the site view must not show the departed town.
  await page.getByRole('button', { name: 'Site', exact: true }).click();
  assert.equal(await page.locator('.site-canvas:visible').count(), 0, 'no departed town on the road');
  await page.getByRole('button', { name: 'Region', exact: true }).click();
  await map.waitFor();
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
        page.on('pageerror', (e) => {
          errors.push(e.message);
          console.error(`screens: page error in ${vp.name}: ${e.stack ?? e.message}`);
        });
        await page.goto(REGION_ONLY ? `${url}?scenario=iron_ford_neighbors` : url);
        await page.getByTestId('settlement').waitFor({ timeout: 20_000 });
        await page.locator('.site-canvas').waitFor();
        await page.waitForLoadState('networkidle');
        if (REGION_ONLY) {
          await regionLoop(page, vp, errors);
          await context.close();
          continue;
        }
        assert.equal(await page.getByTestId('settlement').getAttribute('data-layout'), vp.layout, 'layout');
        await page.getByTestId('vitals').waitFor();
        await capture(page, `${vp.name}-start`, errors);
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
        await clearDispatches(page);
        await capture(page, `${vp.name}-map`, errors);
        await playLoop(page, vp, errors);
        await tapPlayer(page, context, vp, errors);
        await closeSheet(page);
        // Folk known, through the Ledger: the PC's own dossier and its tabs.
        await rail(page, 'Ledger');
        await page.getByRole('tab', { name: 'Folk', exact: true }).click();
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
        await rail(page, 'Ledger');
        await page.getByRole('tab', { name: 'Chronicle', exact: true }).click();
        await capture(page, `${vp.name}-chronicle`, errors);
        // God view: Settings only, behind a confirm, and it tags the Chronicle (11 §2.14).
        await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
        await page.getByRole('button', { name: 'God view…', exact: true }).click();
        await capture(page, `${vp.name}-settings`, errors);
        await page.getByRole('button', { name: 'Switch God view on', exact: true }).click();
        await rail(page, 'Ledger');
        await page.getByRole('tab', { name: 'Chronicle', exact: true }).click();
        await page.getByText('God view was used this session').first().waitFor();
        await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
        await page.getByRole('button', { name: 'Turn God view off', exact: true }).click();
        // Save in the browser, then verify the service worker owns this page and cold-start offline.
        await rail(page, 'Ledger');
        await page.getByRole('tab', { name: 'Journey', exact: true }).click();
        await page.getByRole('button', { name: 'Save the journey', exact: true }).click();
        await page.getByText(/^Saved at /).waitFor();
        await capture(page, `${vp.name}-journey`, errors);
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
        // A fresh arrival offline; the kept journey resumes from browser storage.
        await clearDispatches(page);
        await stepHour(page);
        await rail(page, 'Ledger');
        await page.getByRole('tab', { name: 'Journey', exact: true }).click();
        await page.getByRole('button', { name: /^Resume the kept journey/ }).click();
        await page.getByText(/^Resumed from /).waitFor();
        await page.waitForFunction(
          (t) => Number(document.querySelector('[data-testid="clock"]')?.getAttribute('data-time')) > t,
          60,
        );
        await audit(page, errors);
        console.log(`screens: ${vp.name} controls, time, play loop, tap, panels, saves and offline worker passed`);
        await context.setOffline(false);
        await page.goto(`${url}?scenario=iron_ford_neighbors`);
        await page.getByTestId('settlement').waitFor({ timeout: 20_000 });
        await clearDispatches(page);
        await regionLoop(page, vp, errors);
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
