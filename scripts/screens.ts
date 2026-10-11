/**
 * Screenshot the built web app with the system Chromium (no browser downloads).
 * Usage: just screens   (builds first)   |   tsx scripts/screens.ts [--out runs/screens]
 * OWNER: module:web (add views/viewports here).
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const outArg = process.argv.indexOf('--out');
const OUT = join(ROOT, outArg > 0 ? (process.argv[outArg + 1] as string) : 'runs/screens');
const PORT = 4173;
const CHROMIUM = ['/usr/bin/chromium', '/usr/sbin/chromium', '/usr/bin/chromium-browser'].find((p) => existsSync(p));

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'phone', width: 390, height: 844, mobile: true },
] as const;

async function waitForServer(url: string, ms = 15_000): Promise<void> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`server at ${url} did not start`);
}

async function main(): Promise<void> {
  if (!CHROMIUM) throw new Error('no system chromium found');
  if (!existsSync(join(ROOT, 'apps/web/dist/index.html')))
    throw new Error('apps/web/dist missing: run `just web-build`');
  mkdirSync(OUT, { recursive: true });
  const server = spawn('pnpm', ['-C', 'apps/web', 'exec', 'vite', 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  try {
    const url = `http://localhost:${PORT}/`;
    await waitForServer(url);
    const browser = await chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox'] });
    try {
      for (const vp of VIEWPORTS) {
        const ctx = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          isMobile: vp.mobile,
          hasTouch: vp.mobile,
          deviceScaleFactor: vp.mobile ? 3 : 1,
        });
        const page = await ctx.newPage();
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(url);
        await page.waitForSelector('main.screen h2', { timeout: 15_000 });
        const file = join(OUT, `${vp.name}.png`);
        await page.screenshot({ path: file, fullPage: false });
        console.log(`screens: ${vp.name} -> ${file}${errors.length ? ` (page errors: ${errors.join('; ')})` : ''}`);
        await ctx.close();
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
  process.exit(1);
});
