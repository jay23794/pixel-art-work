// Node side: scene or sequence JSON → MP4 + frame-hash manifest.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadScene } from '../scene/loader.ts';
import { applyOverlay, loadSequence, overlayAt, type Overlay, type Transition } from '../scene/sequence.ts';
import { openRenderer } from './capture.ts';
import { startEncoder } from './ffmpeg.ts';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

export interface RenderOptions {
  /** Path to a scene JSON, or a sequence JSON (has `shots`; its scenes are read from `scenesDir`). */
  readonly scene: string;
  /** Where a sequence's scenes live, as <name>.json. Default: scenes/. */
  readonly scenesDir?: string;
  /** Output .mp4 path. The manifest is written next to it as <name>.hashes.json. */
  readonly out: string;
  /** First and last output frame, inclusive. Default: everything. */
  readonly from?: number;
  readonly to?: number;
  readonly ffmpegPath?: string;
  /** Called after each frame is encoded. */
  readonly onProgress?: (done: number, total: number) => void;
}

export interface FrameManifest {
  /** Scene id, or sequence id. */
  readonly scene: string;
  readonly source: string;
  /** Raw frames as captured: RGBA, top-down rows, logical size. */
  readonly format: 'rgba';
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly from: number;
  readonly to: number;
  readonly algorithm: 'sha256';
  /** sha256 of all frame hashes in order. */
  readonly digest: string;
  readonly frames: readonly { readonly n: number; readonly sha256: string }[];
  /** Sequences only: each shot's scene range and its output frames (inclusive). */
  readonly shots?: readonly ShotSummary[];
}

export interface ShotSummary {
  readonly scene: string;
  readonly start: number;
  readonly end: number;
  readonly transition: Transition;
  readonly frames: readonly [number, number];
}

/** A run of consecutive scene frames, written as output frames outFrom… with an optional overlay per frame. */
interface Segment {
  readonly json: unknown;
  readonly source: string;
  readonly sceneFrom: number;
  /** Inclusive. */
  readonly sceneTo: number;
  readonly outFrom: number;
  readonly overlay?: (k: number) => Overlay | undefined;
}

interface Plan {
  readonly id: string;
  readonly frameCount: number;
  /** Covers output frames 0 … frameCount − 1 in order. */
  readonly segments: readonly Segment[];
  readonly shots?: readonly ShotSummary[];
}

const readJson = (path: string, label: string): unknown => {
  if (!existsSync(path)) throw new Error(`${label} not found: ${relative(process.cwd(), path) || path}`);
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error(`${relative(process.cwd(), path) || path} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
  }
};

/** Scene JSON by name from a directory of <name>.json files. */
const readScenes = (dir: string): Record<string, unknown> =>
  Object.fromEntries(
    readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => [basename(f, '.json'), readJson(join(dir, f), 'scene file')]),
  );

/** Validates in Node first (bad files fail before any browser starts) and lays out the output frames. */
function plan(json: unknown, source: string, options: RenderOptions): Plan {
  const assets = readAssets();
  if (json && typeof json === 'object' && 'shots' in json) {
    const seq = loadSequence(json, { source, scenes: readScenes(resolve(options.scenesDir ?? join(ROOT, 'scenes'))), assets });
    return {
      id: seq.id,
      frameCount: seq.frameCount,
      segments: seq.shots.map((s, i) => ({
        json: s.json,
        source: `scenes/${s.scene}.json`,
        sceneFrom: s.sceneFrom,
        sceneTo: s.sceneTo - 1,
        outFrom: s.outFrom,
        overlay: (k: number) => overlayAt(seq, i, k),
      })),
      shots: seq.shots.map((s) => ({
        scene: s.scene,
        start: s.start,
        end: s.end,
        transition: s.transition,
        frames: [s.outFrom, s.outFrom + s.sceneTo - s.sceneFrom - 1] as const,
      })),
    };
  }
  const def = loadScene(json, { source, assets });
  const frameCount = Math.round(def.output.duration * def.output.fps);
  return { id: def.id, frameCount, segments: [{ json, source, sceneFrom: 0, sceneTo: frameCount - 1, outFrom: 0 }] };
}

export interface RenderResult {
  readonly out: string;
  readonly manifestPath: string;
  readonly manifest: FrameManifest;
  readonly timing: { readonly setupMs: number; readonly framesMs: number; readonly finalizeMs: number; readonly totalMs: number; readonly msPerFrame: number };
}

const readAssets = (): Record<string, unknown> => {
  const dir = join(ROOT, 'assets', 'sprites');
  return Object.fromEntries(
    readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => [basename(f, '.json'), JSON.parse(readFileSync(join(dir, f), 'utf8')) as unknown]),
  );
};

/** Renders a scene or sequence to MP4. Throws with a clear message on any failure (and removes the partial MP4). */
export async function renderVideo(options: RenderOptions): Promise<RenderResult> {
  const t0 = performance.now();
  const scenePath = resolve(options.scene);
  const source = relative(process.cwd(), scenePath) || scenePath;
  if (!existsSync(scenePath)) throw new Error(`scene file not found: ${options.scene}`);
  const json = readJson(scenePath, 'scene file');
  const p = plan(json, source, options);
  const { frameCount } = p;
  const from = options.from ?? 0;
  const to = options.to ?? frameCount - 1;
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from || to >= frameCount) {
    throw new Error(`invalid frame range ${from}–${to}: the ${p.shots ? 'sequence' : 'scene'} has frames 0–${frameCount - 1}`);
  }

  const out = resolve(options.out);
  const manifestPath = join(dirname(out), `${basename(out, extname(out))}.hashes.json`);
  await mkdir(dirname(out), { recursive: true });

  const session = await openRenderer();
  let encoder: ReturnType<typeof startEncoder> | undefined;
  try {
    // The parts of each segment inside from…to.
    const runs = p.segments
      .map((seg) => {
        const length = seg.sceneTo - seg.sceneFrom + 1;
        const a = Math.max(from, seg.outFrom),
          z = Math.min(to, seg.outFrom + length - 1);
        return { seg, a, z };
      })
      .filter((r) => r.a <= r.z);
    const info = await session.load((runs[0] as (typeof runs)[number]).seg.json, (runs[0] as (typeof runs)[number]).seg.source);
    const setupMs = performance.now() - t0;
    encoder = startEncoder({
      width: info.width,
      height: info.height,
      fps: info.fps,
      outputWidth: info.outputWidth,
      outputHeight: info.outputHeight,
      out,
      ...(options.ffmpegPath === undefined ? {} : { ffmpegPath: options.ffmpegPath }),
    });
    const enc = encoder;
    const frames: { n: number; sha256: string }[] = [];
    const total = to - from + 1;
    const t1 = performance.now();
    for (const [i, { seg, a, z }] of runs.entries()) {
      if (i > 0) await session.load(seg.json, seg.source);
      const offset = seg.sceneFrom - seg.outFrom; // scene frame = output frame + offset
      await session.capture(a + offset, z + offset, async (sceneN, rgba) => {
        const n = sceneN - offset;
        const overlay = seg.overlay?.(n - seg.outFrom);
        if (overlay) applyOverlay(rgba, overlay);
        frames.push({ n, sha256: createHash('sha256').update(rgba).digest('hex') });
        await enc.write(rgba);
        options.onProgress?.(frames.length, total);
      });
    }
    const t2 = performance.now();
    await enc.finish();
    const t3 = performance.now();

    const manifest: FrameManifest = {
      scene: p.id,
      source,
      format: 'rgba',
      width: info.width,
      height: info.height,
      fps: info.fps,
      from,
      to,
      algorithm: 'sha256',
      digest: createHash('sha256').update(frames.map((f) => f.sha256).join('\n')).digest('hex'),
      frames,
      ...(p.shots ? { shots: p.shots } : {}),
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const framesMs = t2 - t1;
    return {
      out,
      manifestPath,
      manifest,
      timing: { setupMs, framesMs, finalizeMs: t3 - t2, totalMs: performance.now() - t0, msPerFrame: framesMs / total },
    };
  } catch (e) {
    encoder?.abort();
    await rm(out, { force: true });
    throw e;
  } finally {
    await session.close();
  }
}
