import { describe, expect, it } from 'vitest';
import { cleanupFrames, detectScale, downscale, snapToPalette, thresholdAlpha, type RgbaImage } from '../src/assets/cleanup.ts';

/** Image from rows of pixel codes: '.' transparent, other letters map to colours. */
const COLORS: Record<string, number[]> = { r: [200, 30, 30, 255], g: [30, 200, 30, 255], b: [30, 30, 200, 255], h: [200, 30, 30, 100] };
function img(rows: string[]): RgbaImage {
  const width = (rows[0] as string).length, height = rows.length;
  const data = Buffer.alloc(width * height * 4);
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== '.') data.set(COLORS[ch] as number[], (y * width + x) * 4);
    }),
  );
  return { width, height, data };
}
const upscale = (src: RgbaImage, k: number): RgbaImage => {
  const out = Buffer.alloc(src.width * k * src.height * k * 4);
  for (let y = 0; y < src.height * k; y++)
    for (let x = 0; x < src.width * k; x++) src.data.copy(out, (y * src.width * k + x) * 4, (Math.floor(y / k) * src.width + Math.floor(x / k)) * 4, (Math.floor(y / k) * src.width + Math.floor(x / k)) * 4 + 4);
  return { width: src.width * k, height: src.height * k, data: out };
};

const art = img(['..r..', '.rgr.', 'rgbgr', '.r.r.']);

describe('cleanup', () => {
  it('detects the true pixel grid and downscales back exactly', () => {
    const big = upscale(art, 3);
    expect(detectScale(big)).toBe(3);
    expect(downscale(big, 3).data.equals(art.data)).toBe(true);
    expect(detectScale(art)).toBe(1);
  });

  it('refuses a downscale whose blocks are not one colour', () => {
    expect(() => downscale(upscale(art, 1), 1)).not.toThrow();
    expect(() => downscale({ width: 2, height: 2, data: img(['rg', 'rr']).data }, 2)).toThrow('not a clean 2× upscale');
  });

  it('thresholds alpha to 0/255 and clears transparent pixels', () => {
    const t = thresholdAlpha(img(['h', 'r']), 128);
    expect([...t.data]).toEqual([0, 0, 0, 0, 200, 30, 30, 255]);
    expect([...thresholdAlpha(img(['h']), 100).data]).toEqual([200, 30, 30, 255]);
  });

  it('snaps colours to the nearest palette entry', () => {
    const s = snapToPalette(img(['rgb']), [0xff0000, 0x00ff00]);
    expect([...s.data]).toEqual([255, 0, 0, 255, 0, 255, 0, 255, 255, 0, 0, 255]); // blue is nearer red than green? equal → earlier entry
  });

  it('trims to the shared opaque bounds and moves the anchor with it', () => {
    const a = img(['......', '..r...', '..rr..', '......']);
    const b = img(['......', '...g..', '..gg..', '......']);
    const r = cleanupFrames([a, b], { x: 3, y: 3 });
    expect([r.width, r.height]).toEqual([2, 2]);
    expect(r.anchor).toEqual({ x: 1, y: 2 });
    expect(r.trimmed).toEqual({ left: 2, top: 1, right: 2, bottom: 1 });
  });

  it('cleans an upscaled, noisy-alpha sheet: scale, anchor and colours', () => {
    const noisy = upscale(img(['.h.', 'rgr']), 4);
    const r = cleanupFrames([noisy], { x: 4, y: 8 }, { palette: [0xc81e1e, 0x1ec81e] });
    expect(r.scale).toBe(4);
    expect([r.width, r.height]).toEqual([3, 1]);
    expect(r.anchor).toEqual({ x: 1, y: 1 });
    expect(r.colors).toEqual([0x1ec81e, 0xc81e1e]);
  });

  it('verifies the final size', () => {
    expect(() => cleanupFrames([art], { x: 0, y: 0 }, { expect: { width: 5, height: 5 } })).toThrow('size check failed: frames are 5×4, expected 5×5');
    expect(() => cleanupFrames([img(['..'])], { x: 0, y: 0 })).toThrow('every frame is fully transparent');
  });
});
