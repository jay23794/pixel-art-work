import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { afterAll, describe, expect, it } from 'vitest';
import { goldenPath, ROOT, type GoldenSet } from '../scripts/golden.ts';
import { readScene } from '../scripts/scene-render.ts';
import { SceneValidationError } from '../src/scene/loader.ts';
import { applyOverlay, loadSequence, overlayAt, type SequenceDef } from '../src/scene/sequence.ts';
import { renderVideo, type RenderResult } from '../src/video/render.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

const tour = (): Json => JSON.parse(readFileSync(join(ROOT, 'sequences', 'tour.json'), 'utf8'));
const scenes = (): Json => Object.fromEntries(['desert-lab', 'laboratory', 'rainy-city'].map((n) => [n, readScene(n)]));

function issuesFor(seq: Json, sceneJson: Json = scenes()): { path: string; message: string }[] {
  try {
    loadSequence(seq, { scenes: sceneJson });
  } catch (e) {
    if (e instanceof SceneValidationError) return [...e.issues];
    throw e;
  }
  throw new Error('expected the sequence to be rejected');
}

describe('loadSequence: sequences/tour.json', () => {
  const seq = loadSequence(tour(), { scenes: scenes() });

  it('lays the shots out back to back on the scenes’ own frames', () => {
    expect(seq.frameCount).toBe(720);
    expect(seq.shots.map((s) => [s.scene, s.sceneFrom, s.sceneTo, s.outFrom, s.transition])).toEqual([
      ['desert-lab', 120, 360, 0, { type: 'fade', duration: 1 }],
      ['laboratory', 384, 624, 240, { type: 'fade', duration: 1 }],
      ['rainy-city', 720, 960, 480, { type: 'flash', duration: 0.5 }],
    ]);
  });

  it('transition defaults: cut, fade 1s, flash 0.5s', () => {
    const s = tour();
    delete s.shots[0].transition;
    s.shots[1].transition = 'fade';
    s.shots[2].transition = 'flash';
    expect(loadSequence(s, { scenes: scenes() }).shots.map((x) => x.transition)).toEqual([
      { type: 'cut', duration: 0 },
      { type: 'fade', duration: 1 },
      { type: 'flash', duration: 0.5 },
    ]);
  });
});

describe('transitions', () => {
  const seq = loadSequence(tour(), { scenes: scenes() });
  const amounts = (i: number, ks: number[]) => ks.map((k) => overlayAt(seq, i, k));

  it('fade: the previous shot dips to solid black on its last frame, then the next fades up over the same count', () => {
    // 1s fade at 24 fps: 12 frames out, 12 frames in.
    expect(amounts(0, [227, 228, 239]).map((o) => o && [o.color, o.amount])).toEqual([undefined, [0, 1 / 12], [0, 1]]);
    expect(amounts(1, [0, 10, 11, 12]).map((o) => o && [o.color, o.amount])).toEqual([[0, 11 / 12], [0, 1 / 12], [0, 0], undefined]);
  });

  it('first shot with fade: up from black; middle frames untouched', () => {
    expect(overlayAt(seq, 0, 0)).toEqual({ color: 0, amount: 11 / 12 });
    expect(overlayAt(seq, 0, 120)).toBeUndefined();
  });

  it('flash: solid white on the first frame, easing out over its duration; the shot before it does not fade', () => {
    expect(overlayAt(seq, 2, 0)).toEqual({ color: 0xffffff, amount: 1 });
    expect(overlayAt(seq, 2, 6)?.amount).toBeCloseTo(0.25);
    expect(overlayAt(seq, 2, 12)).toBeUndefined();
    expect(overlayAt(seq, 1, 239)).toBeUndefined();
  });

  it('applyOverlay: integer blend, alpha untouched, exact at 0 and 1', () => {
    const px = () => Uint8Array.from([10, 128, 250, 255]);
    const a = px();
    applyOverlay(a, { color: 0x000000, amount: 1 });
    expect([...a]).toEqual([0, 0, 0, 255]);
    const b = px();
    applyOverlay(b, { color: 0xffffff, amount: 1 });
    expect([...b]).toEqual([255, 255, 255, 255]);
    const c = px();
    applyOverlay(c, { color: 0x000000, amount: 0.5 });
    expect([...c]).toEqual([5, 64, 125, 255]);
    const d = px();
    applyOverlay(d, { color: 0, amount: 0 });
    expect([...d]).toEqual([...px()]);
  });
});

describe('loadSequence: invalid sequences fail with the JSON path', () => {
  it('unknown scene', () => {
    const s = tour();
    s.shots[1].scene = 'moonbase';
    expect(issuesFor(s)).toEqual([{ path: 'shots[1].scene', message: 'unknown scene "moonbase" (known: desert-lab, laboratory, rainy-city)' }]);
  });

  it('unknown transition', () => {
    const s = tour();
    s.shots[1].transition = 'wipe';
    expect(issuesFor(s)).toEqual([{ path: 'shots[1].transition', message: expect.any(String) }]);
  });

  it('end beyond the scene, end before start, time off the frame grid', () => {
    const s = tour();
    s.shots[0].end = 41;
    s.shots[1].end = 12;
    s.shots[2].start = 30.01;
    expect(issuesFor(s)).toEqual([
      { path: 'shots[0].end', message: '41s is beyond the scene duration (40s)' },
      { path: 'shots[1].end', message: 'end (12s) must be after start (16s)' },
      { path: 'shots[2].start', message: '30.01s is not on a frame (multiples of 1/24 s)' },
    ]);
  });

  it('scenes must share the output format', () => {
    const sc = scenes();
    sc.laboratory.output.fps = 30;
    expect(issuesFor(tour(), sc)).toContainEqual({ path: 'shots[1].scene', message: expect.stringContaining('different fps (30 vs 24)') });
  });

  it('a shot too short for its transitions', () => {
    const s = tour();
    s.shots[1].end = 16.5; // 12 frames: its own fade in takes 12 …
    s.shots[2].transition = { type: 'fade', duration: 1 }; // … and the next shot's fade takes 12 more to fade it out
    expect(issuesFor(s)).toEqual([{ path: 'shots[1]', message: 'shot is 12 frames but its transitions need 24' }]);
  });

  it('scene errors are reported under the scene file', () => {
    const sc = scenes();
    delete sc['rainy-city'].seed;
    expect(issuesFor(tour(), sc)).toEqual([{ path: 'scenes/rainy-city.json:seed', message: expect.stringMatching(/expected number/i) }]);
  });
});

describe('sequence export: desert → lab → city in one MP4', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'pixelforge-sequence-'));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));
  let result: RenderResult;
  const seq: SequenceDef = loadSequence(tour(), { scenes: scenes() });
  const goldenHash = (set: GoldenSet, n: number): string => createHash('sha256').update(PNG.sync.read(readFileSync(goldenPath(n, set))).data).digest('hex');
  const solid = (rgb: number): string => {
    const px = Buffer.alloc(270 * 480 * 4);
    for (let i = 0; i < px.length; i += 4) px.set([rgb >> 16, (rgb >> 8) & 255, rgb & 255, 255], i);
    return createHash('sha256').update(px).digest('hex');
  };

  it('renders all 720 frames into one 1080×1920 MP4', async () => {
    result = await renderVideo({ scene: 'sequences/tour.json', out: join(tmp, 'tour.mp4') });
    expect(result.manifest.frames.map((f) => f.n)).toEqual(Array.from({ length: 720 }, (_, i) => i));
    expect(result.manifest.shots?.map((s) => [s.scene, s.frames])).toEqual([
      ['desert-lab', [0, 239]],
      ['laboratory', [240, 479]],
      ['rainy-city', [480, 719]],
    ]);
    const probe = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,nb_frames,r_frame_rate', '-of', 'csv=p=0', result.out], { encoding: 'utf8' });
    expect(probe.trim()).toBe('1080,1920,24/1,720');
  }, 180_000);

  it('untouched shot frames are pixel-identical to each scene rendered alone (its golden frames)', () => {
    const frame = (n: number) => result.manifest.frames[n]?.sha256;
    // desert scene frame 240 = output 120; lab 480 = output 336; city 900 = output 660.
    for (const [set, sceneN, i] of [['v1', 240, 0], ['laboratory', 480, 1], ['rainy-city', 900, 2]] as const) {
      const s = seq.shots[i];
      const out = (s?.outFrom ?? 0) + sceneN - (s?.sceneFrom ?? 0);
      expect(overlayAt(seq, i, out - (s?.outFrom ?? 0))).toBeUndefined();
      expect(frame(out), `${set} frame ${sceneN} at output ${out}`).toBe(goldenHash(set, sceneN));
    }
  });

  it('the fade reaches solid black and the flash starts solid white', () => {
    expect(result.manifest.frames[239]?.sha256).toBe(solid(0x000000));
    expect(result.manifest.frames[480]?.sha256).toBe(solid(0xffffff));
  });

  it('is deterministic: re-rendering across both transitions gives the same frames', async () => {
    const again = await renderVideo({ scene: 'sequences/tour.json', out: join(tmp, 'again.mp4'), from: 230, to: 490 });
    expect(again.manifest.frames).toEqual(result.manifest.frames.slice(230, 491));
  }, 180_000);
});
