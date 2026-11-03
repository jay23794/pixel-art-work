// Ordered dithering, ramp shading, and height-map lighting.
import type { Rgb } from './buffer.ts';
import type { Ramp } from './palette.ts';

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
] as const;

/** Bayer 4×4 threshold at pixel (x, y), in (0, 1). */
export const bayer = (x: number, y: number): number => (((BAYER4[y & 3] as readonly number[])[x & 3] as number) + 0.5) / 16;

/**
 * Value 0–1 → ramp colour (0 = deepShadow, 1 = highlight). With dither, the value
 * between two adjacent steps is split with Bayer 4×4 at (x, y); without, it rounds.
 */
export function rampColor(r: Ramp, v: number, x = 0, y = 0, dither = false): Rgb {
  const f = Math.min(1, Math.max(0, v)) * (r.length - 1);
  const k = Math.floor(f);
  const step = dither ? (f - k > bayer(x, y) ? k + 1 : k) : Math.round(f);
  return r[Math.min(step, r.length - 1)] as Rgb;
}

/** A unit vector towards the light, e.g. light(-1, -1, 1) = from the upper left, in front. */
export function light(x: number, y: number, z: number): [number, number, number] {
  const len = Math.hypot(x, y, z);
  return [x / len, y / len, z / len];
}

/**
 * Lambert lighting of a height map (row-major, w×h, any units). Normals come from
 * central differences scaled by `strength` (larger = steeper relief). Returns
 * max(0, n·l) per pixel, in [0, 1].
 */
export function shadeHeightMap(height: Float32Array, w: number, h: number, l: readonly [number, number, number], strength = 1): Float32Array {
  const out = new Float32Array(w * h);
  const at = (x: number, y: number): number => height[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))] as number;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      // Surface z = height; normal = (−dz/dx, −dz/dy, 1). Screen y points down, so a slope
      // rising towards the top of the image faces up (towards negative y).
      const nx = -(at(x + 1, y) - at(x - 1, y)) * 0.5 * strength;
      const ny = -(at(x, y + 1) - at(x, y - 1)) * 0.5 * strength;
      const len = Math.hypot(nx, ny, 1);
      out[y * w + x] = Math.max(0, (nx * l[0] + ny * l[1] + l[2]) / len);
    }
  return out;
}
