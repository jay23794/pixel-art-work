// The lab canvas: 360×640 RGBA, drawn pixel by pixel.

export const W = 360;
export const H = 640;

/** [r, g, b], 0–255. */
export type Rgb = readonly [number, number, number];

export const createBuffer = (): Uint8ClampedArray => new Uint8ClampedArray(W * H * 4);

/** Sets pixel (x, y) if it is on the canvas. Alpha is always opaque. */
export function put(buf: Uint8ClampedArray, x: number, y: number, c: Rgb): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
  buf[i + 3] = 255;
}

/** Nearest-neighbour upscale by a whole factor. */
export function upscale(buf: Uint8ClampedArray, w: number, h: number, s: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * s * h * s * 4);
  for (let y = 0; y < h * s; y++)
    for (let x = 0; x < w * s; x++) {
      const i = (Math.floor(y / s) * w + Math.floor(x / s)) * 4,
        o = (y * w * s + x) * 4;
      out[o] = buf[i] as number;
      out[o + 1] = buf[i + 1] as number;
      out[o + 2] = buf[i + 2] as number;
      out[o + 3] = buf[i + 3] as number;
    }
  return out;
}
