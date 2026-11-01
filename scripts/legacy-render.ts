import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, join } from 'node:path';
import { launchBrowser, openRenderer, ROOT, type FrameRenderer } from './browser.ts';

const LEGACY_DIR = join(ROOT, 'legacy');
const require = createRequire(import.meta.url);
const PIXI_MIN = join(dirname(require.resolve('pixi.js')), '..', 'dist', 'pixi.min.js');
const ORIGIN = 'http://legacy.local';
const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript' };

/**
 * Opens legacy/scene.html (the reference renderer). Requests are served from
 * disk via request interception (no dev server), with pixi.min.js mapped to
 * the npm pixi.js v8 build.
 */
export async function openLegacyScene(): Promise<FrameRenderer> {
  return openRenderer(await launchBrowser(), `${ORIGIN}/scene.html`, async (page) => {
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
  });
}
