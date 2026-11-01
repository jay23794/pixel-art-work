import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AssetDef } from '../src/assets/contract.ts';
import { animationFrame } from '../src/components/sprite.ts';
import type { FrameRenderer } from '../scripts/golden.ts';
import { openSceneJson } from '../scripts/scene-render.ts';

const anim = (durations: number[], fps: number): AssetDef => ({
  id: 'a', type: 'animation', src: 'a.png', width: 1, height: 1, anchor: { x: 0, y: 0 }, fps, tags: [], palette: [],
  frames: durations.map((duration, i) => ({ x: i, y: 0, duration })),
});

describe('animationFrame (integer timing)', () => {
  it('steps at the asset fps inside a 24 fps scene, exactly on the boundaries', () => {
    const walk = anim([1, 1, 1, 1, 1, 1, 1, 1], 10);
    // floor(n·10/24): frame 1 starts at n = 3 (2.4 → 3), frame 0 again at n = 20 (8 steps).
    expect([0, 1, 2, 3, 4, 5, 19, 20].map((n) => animationFrame(walk, n, 24))).toEqual([0, 0, 0, 1, 1, 2, 7, 0]);
    const six = anim([1, 1, 1, 1], 6); // 24/6 = every 4 frames exactly
    expect([0, 3, 4, 7, 8, 15, 16].map((n) => animationFrame(six, n, 24))).toEqual([0, 0, 1, 1, 2, 3, 0]);
  });

  it('honours durations, phase and loop = false', () => {
    const a = anim([2, 1], 24);
    expect([0, 1, 2, 3].map((n) => animationFrame(a, n, 24))).toEqual([0, 0, 1, 0]);
    expect(animationFrame(a, 0, 24, 2)).toBe(1);
    expect(animationFrame(a, 99, 24, 0, false)).toBe(1);
  });
});

describe('sprite component renders an animated asset', () => {
  const scene = {
    version: 1, id: 'sprite-test', seed: 1,
    output: { width: 1080, height: 1920, logicalWidth: 270, logicalHeight: 480, fps: 24, duration: 2 },
    camera: { keyframes: [{ time: 0, x: 0, y: 240 }] },
    layers: [{ id: 'chars', components: [{ id: 'ada', type: 'sprite', asset: 'ada-walk', x: 135, y: 300 }] }],
  };
  let r: FrameRenderer;
  beforeAll(async () => {
    r = await openSceneJson(scene);
  }, 60_000);
  afterAll(async () => {
    await r?.close();
  });

  it('shows frame 0 until n = 3, then the next frame; loops back at n = 20', async () => {
    const [f0, f2, f3, f20] = (await Promise.all([0, 2, 3, 20].map((n) => r.render(n)))) as [Buffer, Buffer, Buffer, Buffer];
    expect(f2.equals(f0)).toBe(true);
    expect(f3.equals(f0)).toBe(false);
    expect(f20.equals(f0)).toBe(true);
  });
});
