import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { PNG } from 'pngjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GOLDEN_FRAMES, goldenPath, ROOT, type FrameRenderer, type GoldenSet } from '../scripts/browser.ts';
import { openScene } from '../scripts/scene-render.ts';

// This test only ever READS tests/golden/. It never creates or updates a golden
// frame: a missing one is a failure. To (re)generate them, see scripts/capture-golden.ts.

const GOLDEN_ROOT = join(ROOT, 'tests', 'golden');
const SET: GoldenSet = 'v1';

/** Path → "sha256 mtimeMs size" for every file under tests/golden/. */
function snapshotGolden(): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else {
        const st = statSync(p);
        out[relative(GOLDEN_ROOT, p)] = `${createHash('sha256').update(readFileSync(p)).digest('hex')} ${st.mtimeMs} ${st.size}`;
      }
    }
  };
  walk(GOLDEN_ROOT);
  return out;
}

function readGolden(n: number): PNG {
  const file = goldenPath(n, SET);
  if (!existsSync(file)) {
    throw new Error(`golden frame missing: ${relative(ROOT, file)} (tests never create it; see scripts/capture-golden.ts)`);
  }
  return PNG.sync.read(readFileSync(file));
}

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

describe(`Desert Lab matches the ${SET} golden frames`, () => {
  const before = snapshotGolden();
  let scene: FrameRenderer;
  beforeAll(async () => {
    scene = await openScene('desert-lab');
  }, 60_000);
  afterAll(async () => {
    await scene?.close();
  });

  it.each(GOLDEN_FRAMES)('frame %i', async (n) => {
    const golden = readGolden(n);
    const actual = PNG.sync.read(await scene.render(n));
    expect([actual.width, actual.height], 'frame size').toEqual([golden.width, golden.height]);
    const diff = countDiffPixels(actual, golden);
    expect(diff, `frame ${n}: ${diff} of ${golden.width * golden.height} pixels differ`).toBe(0);
  }, 30_000);

  // Runs last (tests in a file run in order): the run must not touch tests/golden/.
  it('leaves tests/golden/ unchanged (same files, hashes and mtimes)', () => {
    expect(Object.keys(before).length).toBeGreaterThanOrEqual(GOLDEN_FRAMES.length);
    expect(snapshotGolden()).toEqual(before);
  });
});
