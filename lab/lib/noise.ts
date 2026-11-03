// Seeded 2D noise: simplex and value noise, plus fBm. Output roughly in [-1, 1].
import type { Rng } from './rng.ts';

export type Noise2D = (x: number, y: number) => number;

/** A 512-entry permutation table shuffled by rng (Fisher–Yates). */
function permutation(rng: Rng): Uint8Array {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = rng.int(0, i);
    [p[i], p[j]] = [p[j] as number, p[i] as number];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255] as number;
  return perm;
}

const GRAD = [
  [1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1],
] as const;
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

/** 2D simplex noise (Gustavson's formulation), seeded by rng. */
export function simplex2D(rng: Rng): Noise2D {
  const perm = permutation(rng);
  const corner = (gi: number, x: number, y: number): number => {
    const t = 0.5 - x * x - y * y;
    if (t < 0) return 0;
    const g = GRAD[gi % 8] as readonly [number, number];
    return t ** 4 * (g[0] * x + g[1] * y);
  };
  return (xin, yin) => {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s),
      j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t),
      y0 = yin - (j - t);
    const [i1, j1] = x0 > y0 ? [1, 0] : [0, 1];
    const x1 = x0 - i1 + G2,
      y1 = y0 - j1 + G2,
      x2 = x0 - 1 + 2 * G2,
      y2 = y0 - 1 + 2 * G2;
    const ii = i & 255,
      jj = j & 255;
    const g0 = perm[ii + (perm[jj] as number)] as number;
    const g1 = perm[ii + i1 + (perm[jj + j1] as number)] as number;
    const g2 = perm[ii + 1 + (perm[jj + 1] as number)] as number;
    return 70 * (corner(g0, x0, y0) + corner(g1, x1, y1) + corner(g2, x2, y2));
  };
}

/** 2D value noise: random values on the integer lattice, smoothstep-interpolated. Seeded by rng. */
export function value2D(rng: Rng): Noise2D {
  const perm = permutation(rng);
  const values = new Float32Array(256);
  for (let i = 0; i < 256; i++) values[i] = rng.next() * 2 - 1;
  const at = (x: number, y: number): number => values[perm[(x & 255) + (perm[y & 255] as number)] as number] as number;
  const smooth = (u: number): number => u * u * (3 - 2 * u);
  return (x, y) => {
    const x0 = Math.floor(x),
      y0 = Math.floor(y);
    const u = smooth(x - x0),
      v = smooth(y - y0);
    const a = at(x0, y0),
      b = at(x0 + 1, y0),
      c = at(x0, y0 + 1),
      d = at(x0 + 1, y0 + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

export interface FbmOptions {
  readonly octaves?: number;
  /** Frequency multiplier per octave. */
  readonly lacunarity?: number;
  /** Amplitude multiplier per octave. */
  readonly gain?: number;
}

/** Fractal Brownian motion: summed octaves, normalised back to about [-1, 1]. */
export function fbm(noise: Noise2D, x: number, y: number, { octaves = 5, lacunarity = 2, gain = 0.5 }: FbmOptions = {}): number {
  let sum = 0,
    amp = 1,
    freq = 1,
    norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x * freq, y * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}
