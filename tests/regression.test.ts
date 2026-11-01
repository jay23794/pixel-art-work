import { readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GOLDEN_FRAMES, goldenPath, openLegacyScene, type LegacyScene } from '../scripts/legacy-render.ts';

/** Number of pixels whose RGBA differs at all. */
function countDiffPixels(a: PNG, b: PNG): number {
  let diff = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    if (
      a.data[i] !== b.data[i] ||
      a.data[i + 1] !== b.data[i + 1] ||
      a.data[i + 2] !== b.data[i + 2] ||
      a.data[i + 3] !== b.data[i + 3]
    ) {
      diff++;
    }
  }
  return diff;
}

describe('legacy Desert Lab matches golden frames', () => {
  let scene: LegacyScene;
  beforeAll(async () => {
    scene = await openLegacyScene();
  }, 60_000);
  afterAll(async () => {
    await scene?.close();
  });

  it.each(GOLDEN_FRAMES)('frame %i', async (n) => {
    const golden = PNG.sync.read(await readFile(goldenPath(n)));
    const actual = PNG.sync.read(await scene.render(n));
    expect([actual.width, actual.height], 'frame size').toEqual([golden.width, golden.height]);
    const diff = countDiffPixels(actual, golden);
    expect(diff, `frame ${n}: ${diff} of ${golden.width * golden.height} pixels differ`).toBe(0);
  }, 30_000);
});
