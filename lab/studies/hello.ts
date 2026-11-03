// Hello: a dithered dusk sky with a low sun, and three planes of noise hills lit by it.
import { H, put, W, type Rgb } from '../lib/buffer.ts';
import { fbm, simplex2D, type Noise2D } from '../lib/noise.ts';
import { ramp, type Ramp } from '../lib/palette.ts';
import { light, rampColor, shadeHeightMap } from '../lib/shade.ts';
import type { Study } from '../render.ts';

const sky = ramp('dusk');
const sun = ramp('sun');

interface Plane {
  /** Mean crest y and crest amplitude (px). */
  base: number;
  amp: number;
  /** Crest wavelength (px), octaves, and the noise row it samples. */
  wave: number;
  octaves: number;
  row: number;
  ramp: Ramp;
  /** Lowest and highest ramp step used for the fill (far planes use fewer steps). */
  lo: number;
  hi: number;
  /** Relief noise strength and feature size (px). */
  relief: number;
  grain: number;
  /** Crest line: deepShadow outline + lit rim (foreground planes only). */
  outline: boolean;
}

/** One hill plane: fBm crest, height map = crest elevation fading downwards + relief, Lambert-lit. */
function drawPlane(buf: Uint8ClampedArray, noise: Noise2D, pl: Plane, L: readonly [number, number, number], rough: number, fill: Uint8Array): void {
  const tops = new Float32Array(W);
  for (let x = 0; x < W; x++) tops[x] = pl.base - pl.amp * fbm(noise, x / pl.wave, pl.row, { octaves: pl.octaves, gain: 0.35 + rough * 0.25 });
  // The crest's elevation carries down the face (so slopes keep facing left/right), smoothed
  // over ±8 px so single-pixel crest wiggles don't streak down the hill.
  const smooth = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    let sum = 0;
    for (let k = -8; k <= 8; k++) sum += tops[Math.min(W - 1, Math.max(0, x + k))] as number;
    smooth[x] = sum / 17;
  }
  const height = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const below = Math.max(0, y - (tops[x] as number));
      // The carried crest shapes only a short band below it (longer streaks columns); the
      // face rolls away from the viewer below the crest, and relief adds texture.
      height[y * W + x] = (H - (smooth[x] as number)) * Math.exp(-below / 28) - below * 0.35 + pl.relief * fbm(noise, x / pl.grain, y / (pl.grain * 0.6) + pl.row * 10, { octaves: 2, gain: 0.4 + rough * 0.2 });
    }
  const lit = shadeHeightMap(height, W, H, L, 0.9);
  const steps = pl.hi - pl.lo;
  for (let x = 0; x < W; x++) {
    const top = Math.round(tops[x] as number);
    for (let y = Math.max(0, top); y < H; y++) {
      put(buf, x, y, pl.ramp[pl.lo + Math.round(Math.min(1, Math.max(0, lit[y * W + x] as number)) * steps)] as Rgb);
      fill[y * W + x] = y > top + 1 ? 1 : 0; // the crest rows are drawn deliberately; leave them alone
    }
    if (!pl.outline) continue;
    // Crest: a 2 px lit rim where the crest slopes down towards the sun, a deepShadow
    // outline elsewhere. Slope over ±3 px so the rim comes in runs, not single pixels.
    const slope = ((tops[Math.min(W - 1, x + 3)] as number) - (tops[Math.max(0, x - 3)] as number)) * Math.sign(L[0]);
    if (slope > 1.5) {
      put(buf, x, top, pl.ramp[4] as Rgb);
      put(buf, x, top + 1, pl.ramp[3] as Rgb);
    } else put(buf, x, top, pl.ramp[0] as Rgb);
  }
}

/** Replaces each masked pixel that differs from all 4 neighbours with its left neighbour (one pass). The sky's dither is not masked. */
function removeOrphans(buf: Uint8ClampedArray, mask: Uint8Array): void {
  const src = buf.slice();
  const key = (x: number, y: number): number => {
    const i = (y * W + x) * 4;
    return ((src[i] as number) << 16) | ((src[i + 1] as number) << 8) | (src[i + 2] as number);
  };
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      if (!mask[y * W + x]) continue;
      const c = key(x, y);
      const n = [key(x - 1, y), key(x + 1, y), key(x, y - 1), key(x, y + 1)];
      if (n.every((k) => k !== c)) {
        const i = (y * W + x) * 4,
          j = (y * W + x - 1) * 4;
        buf[i] = src[j] as number;
        buf[i + 1] = src[j + 1] as number;
        buf[i + 2] = src[j + 2] as number;
      }
    }
}

export default {
  name: 'hello',
  duration: 10,
  params: {
    horizon: { min: 300, max: 440, step: 1, value: 372 },
    hills: { min: 20, max: 140, step: 1, value: 70 },
    roughness: { min: 0, max: 1, step: 0.05, value: 0.4 },
    sunX: { min: 40, max: 320, step: 1, value: 252 },
    relief: { min: 0, max: 30, step: 1, value: 10 },
  },
  draw(buf, t, rng, p) {
    const noise = simplex2D(rng);
    const horizon = Math.round(p.horizon as number);
    const hills = p.hills as number,
      rough = p.roughness as number,
      relief = p.relief as number;
    // The sun sinks slowly over the loop. One light for the whole image: from the sun
    // (to the right, low), slightly in front of the scene.
    const sunX = Math.round(p.sunX as number),
      sunY = Math.round(horizon - 64 + t * 3),
      sunR = 15;
    const L = light(sunX - W / 2, -60, 140);

    // Sky: dusk ramp from dark (top) to bright (horizon), Bayer-dithered between adjacent
    // steps; a warm glow around the sun.
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const d = Math.hypot(x - sunX, (y - sunY) * 1.5);
        const glow = Math.max(0, 1 - d / 160) ** 1.5 * 0.4;
        put(buf, x, y, rampColor(sky, Math.min(0.97, (y / horizon) ** 1.4 * 0.85 + glow), x, y, true));
      }
    for (let y = sunY - sunR; y <= sunY + sunR; y++)
      for (let x = sunX - sunR; x <= sunX + sunR; x++) {
        const d = Math.hypot(x - sunX, y - sunY);
        if (d <= sunR + 0.3) put(buf, x, y, sun[d < sunR * 0.6 ? 4 : 3]);
      }

    // Hill fills (not crests, not sky) are cleaned of orphan pixels at the end.
    const fill = new Uint8Array(W * H);
    // Three planes, far to near: atmospheric mountains, mid hills, near hills.
    drawPlane(buf, noise, { base: horizon - 6, amp: hills * 0.9, wave: 70, octaves: 4, row: 3.1, ramp: ramp('far'), lo: 2, hi: 3, relief: 0, grain: 26, outline: false }, L, rough, fill);
    drawPlane(buf, noise, { base: horizon + 34, amp: hills * 0.7, wave: 110, octaves: 5, row: 8.7, ramp: ramp('grass'), lo: 1, hi: 3, relief, grain: 46, outline: true }, L, rough, fill);
    drawPlane(buf, noise, { base: horizon + 120, amp: hills * 0.8, wave: 150, octaves: 5, row: 15.2, ramp: ramp('jungle'), lo: 0, hi: 3, relief: relief * 1.4, grain: 56, outline: true }, L, rough, fill);
    removeOrphans(buf, fill);
  },
} satisfies Study;
