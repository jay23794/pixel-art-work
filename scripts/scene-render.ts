import { createServer } from 'vite';
import { launchBrowser, openRenderer, ROOT, type FrameRenderer } from './browser.ts';

/**
 * Opens the PixelForge preview page (index.html) on a private Vite dev server
 * (random free port), so tests render through exactly the code the preview uses.
 */
export async function openScene(): Promise<FrameRenderer> {
  const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 0, strictPort: false } });
  await server.listen();
  const url = server.resolvedUrls?.local[0];
  if (!url) {
    await server.close();
    throw new Error('vite dev server did not report a URL');
  }
  return openRenderer(await launchBrowser(), url, undefined, () => server.close());
}
