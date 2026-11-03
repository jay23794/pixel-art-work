// Palette ramps, loaded from the table in docs/art-direction.md, and the
// nearest-palette lock (OKLab distance).
import artDirection from '../../docs/art-direction.md?raw';
import type { Rgb } from './buffer.ts';

/** Ramp steps, darkest to lightest. */
export const STEPS = ['deepShadow', 'shadow', 'base', 'light', 'highlight'] as const;

/** A ramp: 5 colours from deepShadow (0) to highlight (4). */
export type Ramp = readonly [Rgb, Rgb, Rgb, Rgb, Rgb];

const rgb = (hex: string): Rgb => {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};

/** Table rows `| name | #hex × 5 | … |` → ramps by name. Throws if a row is malformed. */
export function parseRamps(markdown: string): Record<string, Ramp> {
  const out: Record<string, Ramp> = {};
  for (const line of markdown.split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    const hexes = cells.filter((c) => /^#[0-9a-fA-F]{6}$/.test(c));
    if (hexes.length === 0) continue;
    const name = cells[1] as string;
    if (hexes.length !== 5) throw new Error(`docs/art-direction.md: ramp "${name}" needs 5 colours, has ${hexes.length}`);
    out[name] = hexes.map(rgb) as unknown as Ramp;
  }
  return out;
}

export const RAMPS: Readonly<Record<string, Ramp>> = parseRamps(artDirection);

/** A ramp by name, with a helpful error. */
export function ramp(name: string): Ramp {
  const r = RAMPS[name];
  if (!r) throw new Error(`unknown ramp "${name}" (docs/art-direction.md has: ${Object.keys(RAMPS).join(', ')})`);
  return r;
}

/** Every palette colour (all ramps). */
export const PALETTE: readonly Rgb[] = Object.values(RAMPS).flat();

// sRGB → OKLab (Björn Ottosson), for perceptual nearest-colour matching.
const lin = (c: number): number => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
export function oklab([r8, g8, b8]: Rgb): [number, number, number] {
  const r = lin(r8),
    g = lin(g8),
    b = lin(b8);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

/**
 * Replaces every pixel with the perceptually nearest palette colour (in place).
 * Ties go to the earlier palette entry. Results are cached per input colour.
 */
export function lockToPalette(buf: Uint8ClampedArray, palette: readonly Rgb[] = PALETTE): void {
  const labs = palette.map(oklab);
  const cache = new Map<number, Rgb>();
  for (let i = 0; i < buf.length; i += 4) {
    const key = ((buf[i] as number) << 16) | ((buf[i + 1] as number) << 8) | (buf[i + 2] as number);
    let c = cache.get(key);
    if (!c) {
      const [L, A, B] = oklab([buf[i] as number, buf[i + 1] as number, buf[i + 2] as number]);
      let best = 0,
        bestD = Infinity;
      labs.forEach(([l, a, b], k) => {
        const d = (l - L) ** 2 + (a - A) ** 2 + (b - B) ** 2;
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      });
      c = palette[best] as Rgb;
      cache.set(key, c);
    }
    buf[i] = c[0];
    buf[i + 1] = c[1];
    buf[i + 2] = c[2];
    buf[i + 3] = 255;
  }
}
