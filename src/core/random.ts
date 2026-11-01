// Seeded randomness. The only source of randomness allowed in rendering code.

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform float in [a, b). */
  range(a: number, b: number): number;
  /** Uniform integer in [a, b], both ends inclusive. */
  int(a: number, b: number): number;
  /** Uniformly chosen element. Throws on an empty array. */
  pick<T>(arr: readonly T[]): T;
}

function rngFrom(next: () => number): Rng {
  return {
    next,
    range: (a, b) => a + (b - a) * next(),
    int(a, b) {
      const lo = Math.ceil(Math.min(a, b));
      const hi = Math.floor(Math.max(a, b));
      if (lo > hi) throw new RangeError(`int(${a}, ${b}): no integer in range`);
      return lo + Math.floor(next() * (hi - lo + 1));
    },
    pick<T>(arr: readonly T[]): T {
      if (arr.length === 0) throw new RangeError('pick() from an empty array');
      return arr[Math.floor(next() * arr.length)] as T;
    },
  };
}

/** mulberry32: fast 32-bit generator. Same seed → same sequence. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return rngFrom(() => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  });
}

/**
 * Stable 32-bit seed for a component's own stream, from the scene seed and the
 * component id. FNV-1a over the id, mixed with the scene seed, then a
 * murmur3 finalizer so nearby ids and seeds give unrelated streams.
 */
export function deriveSeed(sceneSeed: number, id: string): number {
  let h = 0x811c9dc5 ^ (sceneSeed >>> 0);
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

const LCG_MOD = 2147483647; // 2^31 - 1
const LCG_MUL = 16807;

/**
 * Park–Miller LCG exactly as in legacy/scene.html:
 *   seed = (seed * 16807) % 2147483647; return seed / 2147483647
 * Use only when porting legacy code that must stay pixel-identical. The
 * product stays below 2^53, so float arithmetic is exact.
 * next() returns a value in (0, 1) for any seed in [1, 2^31 - 2].
 */
export function createLegacyRng(seed = 11): Rng {
  let s = seed;
  return rngFrom(() => (s = (s * LCG_MUL) % LCG_MOD) / LCG_MOD);
}
