import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hex, readPng } from '../src/assets/cleanup.ts';
import { assetSchema } from '../src/assets/contract.ts';

const DIR = new URL('../assets/sprites/', import.meta.url).pathname;
const ids = readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => basename(f, '.json')).sort();

describe('bundled assets (assets/sprites)', () => {
  it('includes the Desert Lab art and the imported sample', () => {
    expect(ids).toEqual(['ada-walk', 'camp-chair', 'crate', 'generator', 'light-pole', 'saguaro-short', 'saguaro-tall', 'trailer']);
  });

  for (const id of ids) {
    it(`${id}: valid contract, image matches frames, binary alpha, palette = colours used`, async () => {
      const def = assetSchema.parse(JSON.parse(readFileSync(join(DIR, `${id}.json`), 'utf8')));
      expect(def.id).toBe(id);
      const file = join(DIR, def.src);
      expect(existsSync(file), `${def.src} exists`).toBe(true);
      const img = await readPng(file);
      const colors = new Set<number>();
      const alphas = new Set<number>();
      for (const f of def.frames) {
        expect(f.x + def.width).toBeLessThanOrEqual(img.width);
        expect(f.y + def.height).toBeLessThanOrEqual(img.height);
      }
      for (let i = 0; i < img.data.length; i += 4) {
        alphas.add(img.data[i + 3] as number);
        if (img.data[i + 3]) colors.add(img.data.readUInt32BE(i) >>> 8);
      }
      expect([...alphas].every((a) => a === 0 || a === 255), `alpha values ${[...alphas]}`).toBe(true);
      expect(def.palette).toEqual([...colors].sort((a, b) => a - b).map(hex));
    });
  }
});

describe('asset contract', () => {
  const base = { id: 'x', type: 'sprite', src: 'x.png', width: 4, height: 4, anchor: { x: 0, y: 4 }, frames: [{ x: 0, y: 0 }] };
  const issues = (a: unknown) => {
    const r = assetSchema.safeParse(a);
    return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
  };

  it('accepts a sprite and applies defaults', () => {
    expect(assetSchema.parse(base)).toMatchObject({ tags: [], palette: [], frames: [{ x: 0, y: 0, duration: 1 }] });
  });
  it('a sprite has exactly one frame', () => {
    expect(issues({ ...base, frames: [{ x: 0, y: 0 }, { x: 4, y: 0 }] })).toEqual(['frames: a sprite has exactly 1 frame (got 2); use type "animation"']);
  });
  it('an animation needs 2+ frames and fps', () => {
    expect(issues({ ...base, type: 'animation' })).toEqual(['frames: an animation needs at least 2 frames', 'fps: an animation needs fps']);
  });
  it('anchors are whole pixels and src is a PNG', () => {
    expect(issues({ ...base, anchor: { x: 0.5, y: 4 }, src: 'x.gif' })).toHaveLength(2);
  });
});
