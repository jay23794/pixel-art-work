// Node side: drives the renderer page (render.html) in headless Chromium.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';
import { createServer, type Plugin } from 'vite';
import type { SceneInfo } from './page.ts';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const FRAME_ENDPOINT = '/__pixelforge/frame';

/** Receives one frame: raw RGBA, top-down rows, logical size. Resolve once it is consumed (backpressure). */
export type FrameSink = (n: number, rgba: Buffer) => Promise<void>;

export interface RendererSession {
  readonly page: Page;
  /** Loads scene JSON; resolves once the scene is built and ready. */
  load(scene: unknown, source?: string): Promise<SceneInfo>;
  /** Renders frames from…to (inclusive) in order, handing each raw frame to `sink`. */
  capture(from: number, to: number, sink: FrameSink): Promise<void>;
  /** Frame n as PNG bytes (tests and golden frames). */
  png(n: number): Promise<Buffer>;
  close(): Promise<void>;
}

/**
 * Starts a private Vite dev server (random port, no HMR) and opens render.html
 * in headless Chromium with software WebGL. Fails fast: the first page error or
 * console error closes the browser and makes every pending call reject with it.
 */
export async function openRenderer(): Promise<RendererSession> {
  let sink: FrameSink | undefined;
  let failure: Error | undefined;
  let browser: Browser | undefined;
  const fail = (reason: string | Error): void => {
    if (failure) return;
    failure = typeof reason === 'string' ? new Error(reason) : reason;
    void browser?.close();
  };

  const capturePlugin: Plugin = {
    name: 'pixelforge-capture',
    configureServer(server) {
      server.middlewares.use(FRAME_ENDPOINT, (req: IncomingMessage, res: ServerResponse) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          const n = Number(new URL(req.url ?? '', 'http://x').searchParams.get('n'));
          const done = (status: number, message = ''): void => {
            res.statusCode = status;
            res.end(message);
          };
          if (!sink) return done(409, 'no capture in progress');
          sink(n, Buffer.concat(chunks)).then(
            () => done(204),
            (e: unknown) => {
              // Record the real cause first: the page will also log the 500 as a console error.
              fail(e instanceof Error ? e : new Error(String(e)));
              done(500, e instanceof Error ? e.message : String(e));
            },
          );
        });
      });
    },
  };

  const server = await createServer({
    root: ROOT,
    logLevel: 'error',
    plugins: [capturePlugin],
    server: { port: 0, strictPort: false, hmr: false },
  });
  /** Prefer the recorded page/console failure over the generic error it caused. */
  const rethrow = (e: unknown): never => {
    throw failure ?? e;
  };

  try {
    await server.listen();
    const url = server.resolvedUrls?.local[0];
    if (!url) throw new Error('vite dev server did not report a URL');
    browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const page = await browser.newPage();
    page.on('pageerror', (e) => fail(`page error: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') fail(`console error: ${m.text()}`);
    });
    page.on('crash', () => fail('page crashed'));
    await page.goto(`${url}render.html`);
    await page.waitForFunction(() => typeof window.pixelforge !== 'undefined');
    if (failure) throw failure;

    const b = browser;
    return {
      page,
      load: (scene, source) => page.evaluate(([s, src]) => window.pixelforge.load(s, src), [scene, source] as const).catch(rethrow),
      async capture(from, to, frameSink) {
        let expected = from;
        sink = async (n, rgba) => {
          if (n !== expected) throw new Error(`frames out of order: got ${n}, expected ${expected}`);
          expected++;
          await frameSink(n, rgba);
        };
        try {
          await page.evaluate(([a, z, ep]) => window.pixelforge.capture(a, z, ep), [from, to, FRAME_ENDPOINT] as const);
        } catch (e) {
          rethrow(e);
        } finally {
          sink = undefined;
        }
        if (failure) throw failure;
        if (expected !== to + 1) throw new Error(`captured frames ${from}–${expected - 1}, expected up to ${to}`);
      },
      async png(n) {
        const dataUrl = await page.evaluate((f) => window.pixelforge.png(f), n).catch(rethrow);
        if (failure) throw failure;
        return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
      },
      async close() {
        await b.close();
        await server.close();
      },
    };
  } catch (e) {
    await browser?.close();
    await server.close();
    throw failure ?? e;
  }
}
