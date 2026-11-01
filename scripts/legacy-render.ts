import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LEGACY_DIR = join(ROOT, 'legacy');
const require = createRequire(import.meta.url);
const PIXI_MIN = join(dirname(require.resolve('pixi.js')), '..', 'dist', 'pixi.min.js');

export const GOLDEN_FRAMES = [0, 24, 120, 240, 480, 720, 900] as const;
export const GOLDEN_DIR = join(ROOT, 'tests', 'golden', 'legacy');
export const goldenPath = (n: number): string => join(GOLDEN_DIR, `f${String(n).padStart(4, '0')}.png`);

declare global {
  interface Window {
    ready: Promise<boolean>;
    renderFrame: (n: number) => string;
  }
}

const ORIGIN = 'http://legacy.local';
const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript' };

export interface LegacyScene {
  /** Renders frame n and returns it as PNG bytes. */
  render(n: number): Promise<Buffer>;
  close(): Promise<void>;
}

/**
 * Opens legacy/scene.html in headless Chromium with software WebGL.
 * Requests are served from disk via request interception (no dev server),
 * with pixi.min.js mapped to the npm pixi.js v8 build.
 */
export async function openLegacyScene(): Promise<LegacyScene> {
  const browser: Browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errors: string[] = [];
  try {
    const page: Page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route(`${ORIGIN}/**`, async (route) => {
      const name = new URL(route.request().url()).pathname.slice(1);
      const file = name === 'pixi.min.js' ? PIXI_MIN : join(LEGACY_DIR, name);
      if (!file.startsWith(LEGACY_DIR) && file !== PIXI_MIN) return route.fulfill({ status: 404 });
      try {
        const body = await readFile(file);
        await route.fulfill({ body, contentType: MIME[extname(file)] ?? 'application/octet-stream' });
      } catch {
        await route.fulfill({ status: 404 });
      }
    });
    await page.goto(`${ORIGIN}/scene.html`);
    await page.evaluate(() => window.ready);
    if (errors.length) throw new Error(`legacy scene errors: ${errors.join('; ')}`);
    return {
      async render(n) {
        const url = await page.evaluate((frame) => window.renderFrame(frame), n);
        if (errors.length) throw new Error(`legacy scene errors: ${errors.join('; ')}`);
        return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
      },
      close: () => browser.close(),
    };
  } catch (e) {
    await browser.close();
    throw e;
  }
}
