import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readPng, writePng } from '../src/assets/cleanup.ts';
import { assetSchema } from '../src/assets/contract.ts';
import { importFrameBaker, readFrameBakerExport, readPalette } from '../src/assets/importer.ts';

const FIX = 'tests/fixtures/framebaker';
const tmp = mkdtempSync(join(tmpdir(), 'pixelforge-import-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('FrameBaker importer', () => {
  it('imports a real FrameBaker export (zip): animation asset with the export timing', async () => {
    const r = await importFrameBaker(`${FIX}/ada-walk_spritesheet.zip`, { id: 'walk', outDir: tmp });
    expect(r.asset).toMatchObject({ id: 'walk', type: 'animation', src: 'walk.png', width: 21, height: 47, anchor: { x: 11, y: 24 }, fps: 10 });
    expect(r.asset.frames).toHaveLength(8);
    expect(r.asset.frames.map((f) => f.x)).toEqual([0, 21, 42, 63, 84, 105, 126, 147]);
    expect(assetSchema.parse(JSON.parse(readFileSync(r.json, 'utf8')))).toEqual(r.asset);
    const png = await readPng(r.png);
    expect([png.width, png.height]).toEqual([168, 47]);
  });

  it('imports an opaque full-scene export (no trim possible)', async () => {
    const r = await importFrameBaker(`${FIX}/pip-walk_spritesheet.zip`, { id: 'pip', outDir: tmp });
    expect(r.asset).toMatchObject({ type: 'animation', width: 320, height: 180, anchor: { x: 160, y: 90 }, fps: 8 });
    expect(r.cleanup.trimmed).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
  });

  it('recovers the true pixel grid from an upscaled export', async () => {
    // Build a 3× nearest-neighbour upscale of the idle export as a FrameBaker folder.
    const { meta, sheet } = readFrameBakerExport(`${FIX}/ada-idle_spritesheet.zip`);
    const src = await readPng(sheet);
    const k = 3;
    const big = Buffer.alloc(src.width * k * src.height * k * 4);
    for (let y = 0; y < src.height * k; y++)
      for (let x = 0; x < src.width * k; x++) {
        const s = (Math.floor(y / k) * src.width + Math.floor(x / k)) * 4;
        src.data.copy(big, (y * src.width * k + x) * 4, s, s + 4);
      }
    const dir = join(tmp, 'idle3x');
    mkdirSync(dir);
    await writePng(join(dir, 'Idle.png'), { width: src.width * k, height: src.height * k, data: big });
    const scaled = {
      frames: meta.frames.map((f) => ({ ...f, file: 'Idle.png', x: f.x * k, y: f.y * k, w: f.w * k, h: f.h * k })),
      meta: { ...meta.meta, cellWidth: meta.meta.cellWidth * k, cellHeight: meta.meta.cellHeight * k, originX: meta.meta.originX * k, originY: meta.meta.originY * k },
    };
    writeFileSync(join(dir, 'Idle.frames.json'), JSON.stringify(scaled));

    const one = await importFrameBaker(`${FIX}/ada-idle_spritesheet.zip`, { id: 'idle1x', outDir: tmp });
    const three = await importFrameBaker(dir, { id: 'idle3x', outDir: tmp });
    expect(three.cleanup.scale).toBe(3);
    expect({ ...three.asset, id: 'x', src: 'x' }).toEqual({ ...one.asset, id: 'x', src: 'x' });
    expect((await readPng(three.png)).data.equals((await readPng(one.png)).data)).toBe(true);
  });

  it('snaps to a palette (here: the Desert Lab scene palette)', async () => {
    const palette = readPalette('scenes/desert-lab.json');
    const r = await importFrameBaker(`${FIX}/ada-walk_spritesheet.zip`, { id: 'walk-desert', outDir: tmp, palette });
    expect(r.asset.palette.every((c) => palette.includes(parseInt(c.slice(1), 16)))).toBe(true);
  });

  it('verifies size, refuses to overwrite, and reports bad input clearly', async () => {
    await expect(importFrameBaker(`${FIX}/ada-walk_spritesheet.zip`, { id: 'w2', outDir: tmp, expect: { width: 32, height: 32 } })).rejects.toThrow('size check failed: frames are 21×47, expected 32×32');
    await expect(importFrameBaker(`${FIX}/ada-walk_spritesheet.zip`, { id: 'walk', outDir: tmp })).rejects.toThrow('asset "walk" already exists');
    await expect(importFrameBaker(`${FIX}/missing.zip`, { id: 'm', outDir: tmp })).rejects.toThrow('export not found');
    writeFileSync(join(tmp, 'other.frames.json'), JSON.stringify({ frames: [], meta: {} }));
    expect(() => readFrameBakerExport(join(tmp, 'other.frames.json'))).toThrow(/is not a FrameBaker spritesheet export/);
  });

  it('CLI: imports and prints a summary; exits 1 on errors', () => {
    const ok = spawnSync('npx', ['tsx', 'src/assets/import-cli.ts', `${FIX}/ada-walk_spritesheet.zip`, '--id', 'cli-walk', '--out', tmp, '--tags', 'a,b'], { encoding: 'utf8' });
    expect(ok.status, ok.stderr).toBe(0);
    expect(ok.stdout).toContain('imported cli-walk: animation, 8 frame(s) of 21×47 at 10 fps, anchor (11, 24)');
    expect(JSON.parse(readFileSync(join(tmp, 'cli-walk.json'), 'utf8')).tags).toEqual(['a', 'b']);
    const bad = spawnSync('npx', ['tsx', 'src/assets/import-cli.ts', `${FIX}/ada-walk_spritesheet.zip`], { encoding: 'utf8' });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('import failed: --id is required');
  }, 60_000);
});
