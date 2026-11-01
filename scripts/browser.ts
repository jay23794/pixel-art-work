import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const GOLDEN_FRAMES = [0, 24, 120, 240, 480, 720, 900] as const;
export const GOLDEN_DIR = join(ROOT, 'tests', 'golden', 'legacy');
export const goldenPath = (n: number): string => join(GOLDEN_DIR, `f${String(n).padStart(4, '0')}.png`);

/** A page exposing window.ready and window.renderFrame(n) → PNG data URL. */
export interface FrameRenderer {
  /** Renders frame n and returns it as PNG bytes. */
  render(n: number): Promise<Buffer>;
  close(): Promise<void>;
}

/** Headless Chromium with software WebGL, so output is the same on every machine. */
export const launchBrowser = (): Promise<Browser> =>
  chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

/**
 * Opens `url` in a new page of `browser`, waits for window.ready and returns a
 * renderer. `setup` runs before navigation (e.g. to install request routes).
 * `cleanup` runs after the browser closes.
 */
export async function openRenderer(
  browser: Browser,
  url: string,
  setup: (page: Page) => Promise<void> = async () => {},
  cleanup: () => Promise<void> = async () => {},
): Promise<FrameRenderer> {
  const errors: string[] = [];
  const check = (): void => {
    if (errors.length) throw new Error(`page errors: ${errors.join('; ')}`);
  };
  const close = async (): Promise<void> => {
    await browser.close();
    await cleanup();
  };
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await setup(page);
    await page.goto(url);
    await page.waitForFunction(() => typeof window.ready !== 'undefined');
    await page.evaluate(() => window.ready);
    check();
    return {
      async render(n) {
        const dataUrl = await page.evaluate((frame) => window.renderFrame(frame), n);
        check();
        return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
      },
      close,
    };
  } catch (e) {
    await close();
    throw e;
  }
}
