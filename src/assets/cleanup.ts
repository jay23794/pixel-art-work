// Node only (uses sharp): pixel-art cleanup for imported sprites.
//   1. threshold alpha to 0/255 (transparent pixels become 0,0,0,0)
//   2. snap opaque colours to a palette (optional)
//   3. downscale to the true pixel grid (auto-detected or given)
//   4. trim to the opaque bounds shared by all frames (anchor follows)
//   5. verify the final frame size (optional)
import sharp from 'sharp';

/** Raw RGBA image, top-down rows. */
export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  readonly data: Buffer;
}

export interface CleanupOptions {
  /** Source upscale factor; 'auto' (default) detects it from pixel runs. */
  readonly scale?: number | 'auto';
  /** Colours (0xRRGGBB) to snap opaque pixels to; nearest by RGB distance, ties to the earlier entry. */
  readonly palette?: readonly number[];
  /** Alpha ≥ threshold → 255, else 0. Default 128; false keeps alpha as is. */
  readonly alphaThreshold?: number | false;
  /** Default true. */
  readonly trim?: boolean;
  /** Fail unless the final frame size matches. */
  readonly expect?: { readonly width?: number; readonly height?: number };
}

export interface CleanupResult {
  readonly frames: readonly RgbaImage[];
  readonly width: number;
  readonly height: number;
  /** Anchor in final frame coordinates. */
  readonly anchor: { readonly x: number; readonly y: number };
  /** Detected or given upscale factor of the source. */
  readonly scale: number;
  /** Colours used, sorted (0xRRGGBB). */
  readonly colors: readonly number[];
  /** What was trimmed off (in downscaled pixels). */
  readonly trimmed: { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };
}

export const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

export async function readPng(file: string | Buffer): Promise<RgbaImage> {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) throw new Error(`expected 4 channels, got ${info.channels}`);
  return { width: info.width, height: info.height, data };
}

export async function writePng(file: string, img: RgbaImage): Promise<void> {
  await sharp(img.data, { raw: { width: img.width, height: img.height, channels: 4 } }).png({ compressionLevel: 9 }).toFile(file);
}

export function crop(img: RgbaImage, x: number, y: number, width: number, height: number): RgbaImage {
  if (x < 0 || y < 0 || x + width > img.width || y + height > img.height) {
    throw new Error(`crop ${width}×${height} at (${x}, ${y}) is outside the ${img.width}×${img.height} image`);
  }
  const data = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row++) img.data.copy(data, row * width * 4, ((y + row) * img.width + x) * 4, ((y + row) * img.width + x + width) * 4);
  return { width, height, data };
}

/** Places frames side by side in one row. */
export function packRow(frames: readonly RgbaImage[]): RgbaImage {
  const first = frames[0];
  if (!first) throw new Error('no frames');
  const out = Buffer.alloc(first.width * frames.length * first.height * 4);
  const rowBytes = first.width * 4;
  frames.forEach((f, i) => {
    for (let row = 0; row < f.height; row++) f.data.copy(out, (row * first.width * frames.length + i * first.width) * 4, row * rowBytes, (row + 1) * rowBytes);
  });
  return { width: first.width * frames.length, height: first.height, data: out };
}

export function thresholdAlpha(img: RgbaImage, threshold = 128): RgbaImage {
  const data = Buffer.from(img.data);
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i + 3] as number) >= threshold) data[i + 3] = 255;
    else data.fill(0, i, i + 4);
  }
  return { ...img, data };
}

export function snapToPalette(img: RgbaImage, palette: readonly number[]): RgbaImage {
  if (palette.length === 0) throw new Error('palette is empty');
  const pr = palette.map((c) => c >> 16), pg = palette.map((c) => (c >> 8) & 255), pb = palette.map((c) => c & 255);
  const cache = new Map<number, number>();
  const data = Buffer.from(img.data);
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const key = ((data[i] as number) << 16) | ((data[i + 1] as number) << 8) | (data[i + 2] as number);
    let best = cache.get(key);
    if (best === undefined) {
      let bestD = Infinity;
      best = 0;
      for (let p = 0; p < palette.length; p++) {
        const d = ((data[i] as number) - (pr[p] as number)) ** 2 + ((data[i + 1] as number) - (pg[p] as number)) ** 2 + ((data[i + 2] as number) - (pb[p] as number)) ** 2;
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      cache.set(key, best);
    }
    data[i] = pr[best] as number;
    data[i + 1] = pg[best] as number;
    data[i + 2] = pb[best] as number;
  }
  return { ...img, data };
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** Largest k such that the image is made of uniform k×k blocks (from run lengths of identical pixels). */
export function detectScale(img: RgbaImage): number {
  const px = (x: number, y: number): number => img.data.readUInt32BE((y * img.width + x) * 4);
  let g = gcd(img.width, img.height);
  for (let y = 0; y < img.height && g > 1; y++) {
    let run = 1;
    for (let x = 1; x <= img.width; x++) {
      if (x < img.width && px(x, y) === px(x - 1, y)) run++;
      else {
        g = gcd(g, run);
        run = 1;
      }
    }
  }
  for (let x = 0; x < img.width && g > 1; x++) {
    let run = 1;
    for (let y = 1; y <= img.height; y++) {
      if (y < img.height && px(x, y) === px(x, y - 1)) run++;
      else {
        g = gcd(g, run);
        run = 1;
      }
    }
  }
  return g;
}

/** Nearest-neighbour downscale by k; every k×k block must be uniform. */
export function downscale(img: RgbaImage, k: number): RgbaImage {
  if (k === 1) return img;
  if (img.width % k || img.height % k) throw new Error(`${img.width}×${img.height} is not divisible by scale ${k}`);
  const w = img.width / k, h = img.height / k;
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = img.data.readUInt32BE(((y * k) * img.width + x * k) * 4);
      for (let dy = 0; dy < k; dy++)
        for (let dx = 0; dx < k; dx++)
          if (img.data.readUInt32BE(((y * k + dy) * img.width + x * k + dx) * 4) !== v)
            throw new Error(`not a clean ${k}× upscale: block at (${x * k}, ${y * k}) is not one colour`);
      data.writeUInt32BE(v, (y * w + x) * 4);
    }
  return { width: w, height: h, data };
}

/** Opaque bounds over all frames, or null if every frame is empty. */
function opaqueBounds(frames: readonly RgbaImage[]): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (const f of frames)
    for (let y = 0; y < f.height; y++)
      for (let x = 0; x < f.width; x++)
        if (f.data[(y * f.width + x) * 4 + 3] !== 0) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/** Cleans same-size frames (e.g. spritesheet cells). `anchor` is in source pixels. */
export function cleanupFrames(source: readonly RgbaImage[], anchor: { x: number; y: number }, options: CleanupOptions = {}): CleanupResult {
  const first = source[0];
  if (!first) throw new Error('no frames to clean up');
  if (source.some((f) => f.width !== first.width || f.height !== first.height)) throw new Error('all frames must be the same size');

  const threshold = options.alphaThreshold ?? 128;
  let frames = threshold === false ? [...source] : source.map((f) => thresholdAlpha(f, threshold));
  if (options.palette) frames = frames.map((f) => snapToPalette(f, options.palette as number[]));

  const scale = options.scale === undefined || options.scale === 'auto' ? frames.map(detectScale).reduce(gcd) : options.scale;
  if (!Number.isInteger(scale) || scale < 1) throw new Error(`scale must be a positive integer, got ${scale}`);
  frames = frames.map((f) => downscale(f, scale));
  let ax = anchor.x / scale, ay = anchor.y / scale;

  const w0 = frames[0]?.width as number, h0 = frames[0]?.height as number;
  let trimmed = { left: 0, top: 0, right: 0, bottom: 0 };
  if (options.trim ?? true) {
    const b = opaqueBounds(frames);
    if (!b) throw new Error('every frame is fully transparent');
    frames = frames.map((f) => crop(f, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1));
    trimmed = { left: b.x0, top: b.y0, right: w0 - 1 - b.x1, bottom: h0 - 1 - b.y1 };
    ax -= b.x0;
    ay -= b.y0;
  }

  const width = frames[0]?.width as number, height = frames[0]?.height as number;
  const e = options.expect;
  if (e && ((e.width !== undefined && e.width !== width) || (e.height !== undefined && e.height !== height))) {
    throw new Error(`size check failed: frames are ${width}×${height}, expected ${e.width ?? width}×${e.height ?? height} (source ${first.width}×${first.height}, scale ${scale}, trimmed ${JSON.stringify(trimmed)})`);
  }

  const colors = new Set<number>();
  for (const f of frames) for (let i = 0; i < f.data.length; i += 4) if (f.data[i + 3] !== 0) colors.add(f.data.readUInt32BE(i) >>> 8);
  return { frames, width, height, anchor: { x: ax, y: ay }, scale, colors: [...colors].sort((a, b) => a - b), trimmed };
}
