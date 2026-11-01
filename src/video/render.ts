// Node side: scene JSON → MP4 + frame-hash manifest.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadScene } from '../scene/loader.ts';
import { openRenderer } from './capture.ts';
import { startEncoder } from './ffmpeg.ts';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

export interface RenderOptions {
  /** Path to the scene JSON. */
  readonly scene: string;
  /** Output .mp4 path. The manifest is written next to it as <name>.hashes.json. */
  readonly out: string;
  /** First and last frame, inclusive. Default: the whole scene. */
  readonly from?: number;
  readonly to?: number;
  readonly ffmpegPath?: string;
  /** Called after each frame is encoded. */
  readonly onProgress?: (done: number, total: number) => void;
}

export interface FrameManifest {
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
}

export interface RenderResult {
  readonly out: string;
  readonly manifestPath: string;
  readonly manifest: FrameManifest;
  readonly timing: { readonly setupMs: number; readonly framesMs: number; readonly finalizeMs: number; readonly totalMs: number; readonly msPerFrame: number };
}

const readShapeAssets = (): Record<string, unknown> => {
  const dir = join(ROOT, 'assets', 'shapes');
  return Object.fromEntries(
    readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => [basename(f, '.json'), JSON.parse(readFileSync(join(dir, f), 'utf8')) as unknown]),
  );
};

/** Renders a scene to MP4. Throws with a clear message on any failure (and removes the partial MP4). */
export async function renderVideo(options: RenderOptions): Promise<RenderResult> {
  const t0 = performance.now();
  const scenePath = resolve(options.scene);
  const source = relative(process.cwd(), scenePath) || scenePath;
  if (!existsSync(scenePath)) throw new Error(`scene file not found: ${options.scene}`);
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(scenePath, 'utf8'));
  } catch (e) {
    throw new Error(`${source} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
  }
  // Validate in Node first: bad scenes fail before any browser starts.
  const def = loadScene(json, { source, shapeAssets: readShapeAssets() });
  const frameCount = Math.round(def.output.duration * def.output.fps);
  const from = options.from ?? 0;
  const to = options.to ?? frameCount - 1;
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from || to >= frameCount) {
    throw new Error(`invalid frame range ${from}–${to}: the scene has frames 0–${frameCount - 1}`);
  }

  const out = resolve(options.out);
  const manifestPath = join(dirname(out), `${basename(out, extname(out))}.hashes.json`);
  await mkdir(dirname(out), { recursive: true });

  const session = await openRenderer();
  let encoder: ReturnType<typeof startEncoder> | undefined;
  try {
    const info = await session.load(json, source);
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
    await session.capture(from, to, async (n, rgba) => {
      frames.push({ n, sha256: createHash('sha256').update(rgba).digest('hex') });
      await enc.write(rgba);
      options.onProgress?.(frames.length, total);
    });
    const t2 = performance.now();
    await enc.finish();
    const t3 = performance.now();

    const manifest: FrameManifest = {
      scene: info.id,
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
