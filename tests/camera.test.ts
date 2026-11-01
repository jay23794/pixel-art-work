import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EASINGS, evaluateCamera, parallaxX, type CameraConfig } from '../src/camera/camera.ts';
import { loadScene } from '../src/scene/loader.ts';

describe('evaluateCamera', () => {
  const cam: CameraConfig = {
    keyframes: [
      { time: 1, x: 0, y: 100, easing: 'linear' },
      { time: 3, x: 10, y: 120, easing: 'linear' },
    ],
  };

  it('holds before the first and after the last keyframe', () => {
    expect(evaluateCamera(cam, 0)).toEqual({ x: 0, y: 100 });
    expect(evaluateCamera(cam, 9)).toEqual({ x: 10, y: 120 });
  });

  it('interpolates between keyframes', () => {
    expect(evaluateCamera(cam, 2)).toEqual({ x: 5, y: 110 });
  });

  it('every easing starts at 0 and ends at 1', () => {
    for (const [name, f] of Object.entries(EASINGS)) {
      expect([name, f(0)]).toEqual([name, 0]);
      expect(f(1), name).toBeCloseTo(1, 12);
    }
  });

  it('parallaxX lands on whole pixels', () => {
    for (const x of [-17.3, 0.49, 3.5, 12.7]) for (const f of [0.08, 0.5, 1.2]) expect(Number.isInteger(parallaxX({ x, y: 0 }, f))).toBe(true);
  });
});

describe('desert-lab camera keyframes reproduce the legacy pan', () => {
  const def = loadScene(JSON.parse(readFileSync(new URL('../scenes/desert-lab.json', import.meta.url), 'utf8')));

  // Every parallax factor used in the scene: layers, components and starfield layers.
  const factors = new Set<number>(def.layers.map((l) => l.parallax));
  for (const c of def.layers.flatMap((l) => l.components)) {
    if (typeof c.params.parallax === 'number') factors.add(c.params.parallax);
    for (const sl of (c.params.layers as { parallax: number }[] | undefined) ?? []) factors.add(sl.parallax);
  }

  it('uses the expected parallax factors', () => {
    expect([...factors].sort((a, b) => a - b)).toEqual([0, 0.08, 0.1, 0.15, 0.25, 0.3, 0.4, 0.5, 0.55, 0.7, 1.2]);
  });

  it('gives the same whole-pixel offsets as round((sin(0.12t)·14 − 4) × f) on every frame', () => {
    const { fps, duration } = def.output;
    const mismatches: string[] = [];
    for (let n = 0; n <= duration * fps; n++) {
      const t = n / fps;
      const cam = evaluateCamera(def.camera, t);
      if (cam.y !== 600) mismatches.push(`frame ${n}: y = ${cam.y}`);
      const legacyCamX = Math.sin(t * 0.12) * 14 - 4;
      for (const f of factors) {
        const want = Math.round(legacyCamX * f);
        const got = parallaxX(cam, f);
        if (got !== want) mismatches.push(`frame ${n}, parallax ${f}: ${got} vs legacy ${want}`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});
