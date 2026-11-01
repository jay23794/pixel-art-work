import { expect, test } from '@playwright/test';

test('legacy desert scene loads and renders a frame', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/legacy/scene.html');
  await page.evaluate(() => window.ready);
  const png = await page.evaluate(() => window.renderFrame(300));
  expect(png.startsWith('data:image/png;base64,')).toBe(true);
  // A blank or failed render is mostly one colour; the desert has many.
  const colours = await page.evaluate(() => {
    const src = document.querySelector('canvas');
    if (!src) return 0;
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const ctx = c.getContext('2d');
    if (!ctx) return 0;
    ctx.drawImage(src, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const set = new Set<number>();
    for (let i = 0; i < d.length; i += 4) set.add(((d[i] ?? 0) << 16) | ((d[i + 1] ?? 0) << 8) | (d[i + 2] ?? 0));
    return set.size;
  });
  expect(errors).toEqual([]);
  expect(colours).toBeGreaterThan(50);
});
