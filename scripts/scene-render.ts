import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser, Page } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import { launchBrowser, openRenderer, ROOT, type FrameRenderer } from './browser.ts';

/** Reads scenes/<name>.json. */
export const readScene = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(ROOT, 'scenes', `${name}.json`), 'utf8')) as Record<string, unknown>;

/** A private Vite dev server (random free port) and a blank harness page in headless Chromium. */
export interface Harness {
  readonly page: Page;
  close(): Promise<void>;
}

async function startVite(): Promise<{ server: ViteDevServer; url: string }> {
  const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 0, strictPort: false } });
  await server.listen();
  const url = server.resolvedUrls?.local[0];
  if (!url) {
    await server.close();
    throw new Error('vite dev server did not report a URL');
  }
  return { server, url };
}

/**
 * Opens tests/harness.html, where page scripts can `await import('/src/...')`
 * the real loader and factory (the code the preview uses).
 */
export async function openHarness(): Promise<Harness> {
  const { server, url } = await startVite();
  let browser: Browser | undefined;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${url}tests/harness.html`);
    const b = browser;
    return {
      page,
      close: async () => {
        await b.close();
        await server.close();
        if (errors.length) throw new Error(`page errors: ${errors.join('; ')}`);
      },
    };
  } catch (e) {
    await browser?.close();
    await server.close();
    throw e;
  }
}

/** Sets window.ready / window.renderFrame for a scene JSON, using the real loader and factory via Vite. */
const SCENE_BOOT = `(scene) => {
  window.ready = (async () => {
    const { loadScene } = await import('/src/scene/loader.ts');
    const { createScene } = await import('/src/scene/factory.ts');
    const app = await createScene(loadScene(scene));
    window.renderFrame = (n) => { app.renderFrame(n); return app.canvas.toDataURL('image/png'); };
    return true;
  })();
}`;

/** Renders a scene given as (already-parsed) JSON, through the loader and factory. */
export async function openSceneJson(json: unknown): Promise<FrameRenderer> {
  const { server, url } = await startVite();
  return openRenderer(
    await launchBrowser(),
    `${url}tests/harness.html`,
    async (page) => {
      // Browser-side code as a string: test runners rewrite import() inside functions,
      // which would then break when Playwright serializes them to the page.
      await page.addInitScript({ content: `(${SCENE_BOOT})(${JSON.stringify(json)});` });
    },
    () => server.close(),
  );
}

/** Renders scenes/<name>.json. */
export const openScene = (name: string): Promise<FrameRenderer> => openSceneJson(readScene(name));
