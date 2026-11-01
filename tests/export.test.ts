import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { afterAll, describe, expect, it } from 'vitest';
import { renderVideo, type RenderResult } from '../src/video/render.ts';
import { goldenPath } from '../scripts/golden.ts';

const tmp = mkdtempSync(join(tmpdir(), 'pixelforge-export-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const render = (name: string, from = 0, to = 48): Promise<RenderResult> =>
  renderVideo({ scene: 'scenes/desert-lab.json', out: join(tmp, name, 'desert-lab.mp4'), from, to });

describe('MP4 export', () => {
  let first: RenderResult;
  let second: RenderResult;

  it('renders frames 0–48 twice with identical frame-hash manifests', async () => {
    first = await render('a');
    second = await render('b');
    expect(first.manifest.frames).toHaveLength(49);
    expect(readFileSync(second.manifestPath, 'utf8')).toBe(readFileSync(first.manifestPath, 'utf8'));
    expect(second.manifest.digest).toBe(first.manifest.digest);
    // Frames really differ from each other (the scene animates).
    expect(new Set(first.manifest.frames.slice(36).map((f) => f.sha256)).size).toBe(13);
  }, 180_000);

  it('captures the same pixels as the golden frames (export = preview)', () => {
    for (const n of [0, 24]) {
      const png = PNG.sync.read(readFileSync(goldenPath(n, 'v1')));
      const golden = createHash('sha256').update(png.data).digest('hex');
      expect(first.manifest.frames[n]?.sha256, `frame ${n}`).toBe(golden);
    }
  });

  it('writes a 1080×1920 H.264 yuv420p MP4 with every frame', () => {
    const probe = JSON.parse(
      execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height,pix_fmt,nb_frames,r_frame_rate,color_space,color_primaries,color_transfer', '-of', 'json', first.out], {
        encoding: 'utf8',
      }),
    ) as { streams: Record<string, string | number>[] };
    expect(probe.streams[0]).toMatchObject({ codec_name: 'h264', width: 1080, height: 1920, pix_fmt: 'yuv420p', nb_frames: '49', r_frame_rate: '24/1', color_space: 'bt709', color_primaries: 'bt709', color_transfer: 'bt709' });
  });

  it('fails fast with a clear message: invalid frame range', async () => {
    await expect(render('c', 950, 970)).rejects.toThrow('invalid frame range 950–970: the scene has frames 0–959');
  });

  it('fails fast with a clear message: FFmpeg missing', async () => {
    await expect(
      renderVideo({ scene: 'scenes/desert-lab.json', out: join(tmp, 'd', 'x.mp4'), from: 0, to: 2, ffmpegPath: 'ffmpeg-does-not-exist' }),
    ).rejects.toThrow('FFmpeg not found ("ffmpeg-does-not-exist")');
  }, 60_000);

  it('CLI exits non-zero with a clear message on a bad scene', () => {
    const r = spawnSync('npx', ['tsx', 'src/video/cli.ts', 'scenes/nope.json'], { encoding: 'utf8' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('render failed: scene file not found: scenes/nope.json');
  }, 60_000);
});
