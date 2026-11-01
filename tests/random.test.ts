import { describe, expect, it } from 'vitest';
import { createRng, deriveSeed } from '../src/core/random.ts';

const take = <T>(next: () => T, count: number): T[] => Array.from({ length: count }, next);

describe('createRng', () => {
  it('gives the same sequence for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect(take(() => a.next(), 1000)).toEqual(take(() => b.next(), 1000));
  });

  it('gives different sequences for different seeds', () => {
    expect(take(createRng(1).next, 10)).not.toEqual(take(createRng(2).next, 10));
  });

  it('next() stays in [0, 1) and is roughly uniform', () => {
    const rng = createRng(7);
    const xs = take(() => rng.next(), 20000);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(mean).toBeCloseTo(0.5, 1);
  });

  it('range(a, b) stays in [a, b)', () => {
    const rng = createRng(3);
    for (let i = 0; i < 2000; i++) {
      const x = rng.range(-5, 10);
      expect(x).toBeGreaterThanOrEqual(-5);
      expect(x).toBeLessThan(10);
    }
  });

  it('int(a, b) is inclusive at both ends and only returns integers', () => {
    const rng = createRng(5);
    const seen = new Set(take(() => rng.int(1, 6), 2000));
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(() => rng.int(0.2, 0.8)).toThrow(RangeError);
  });

  it('pick() returns every element eventually and throws on empty', () => {
    const rng = createRng(9);
    const seen = new Set(take(() => rng.pick(['a', 'b', 'c']), 500));
    expect(seen).toEqual(new Set(['a', 'b', 'c']));
    expect(() => rng.pick([])).toThrow(RangeError);
  });
});

describe('deriveSeed', () => {
  it('is stable for the same inputs', () => {
    expect(deriveSeed(11, 'stars')).toBe(deriveSeed(11, 'stars'));
  });

  it('returns an unsigned 32-bit integer', () => {
    for (const s of [0, 1, 11, -1, 2 ** 32 - 1]) {
      const v = deriveSeed(s, 'x');
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(2 ** 32);
    }
  });

  it('separates ids and scene seeds', () => {
    const ids = ['stars', 'stars2', 'smoke', 'dust', 'a', 'b', ''];
    expect(new Set(ids.map((id) => deriveSeed(11, id))).size).toBe(ids.length);
    expect(deriveSeed(11, 'stars')).not.toBe(deriveSeed(12, 'stars'));
  });
});
