import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openHarness, readScene, type Harness } from '../scripts/scene-render.ts';

// Adding or removing a component must not change any other component's output:
// each component draws from its own stream, createRng(deriveSeed(seed, id)).
// Both scenes are built in the same page and every component's own container is
// rendered and hashed (RGBA pixels), then compared.

type Json = Record<string, unknown> & { layers: { components: Record<string, unknown>[] }[]; seed: number };
type Hashes = Record<string, string>;

const FRAMES = [120, 480];

/** Browser-side: build scene JSON, render each frame, hash each component container. As a string so test transforms leave import() alone. */
const HASH_COMPONENTS = `async ({ scene, ids, frames }) => {
  const { loadScene } = await import('/src/scene/loader.ts');
  const { createScene } = await import('/src/scene/factory.ts');
  const app = await createScene(loadScene(scene));
  const hash = (px) => { let h = 2166136261; for (let i = 0; i < px.length; i++) { h ^= px[i]; h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
  const out = {};
  for (const n of frames) {
    app.renderFrame(n);
    for (const id of ids) {
      const { pixels, width, height } = app.pixi.renderer.extract.pixels(app.container(id));
      const lit = pixels.some((v, i) => i % 4 === 3 && v > 0);
      out[id + '@' + n] = width + 'x' + height + ':' + hash(pixels) + (lit ? '' : ':empty');
    }
  }
  app.destroy();
  return out;
}`;

const scene = (): Json => readScene('desert-lab') as Json;
const ids = (s: Json): string[] => s.layers.flatMap((l) => l.components.map((c) => c.id as string));

/** A milkyWay-type component that draws 500 random numbers: inserted first, it shifts every later draw in a shared stream. */
const EXTRA = {
  id: 'extraSpecks',
  type: 'milkyWay',
  count: 500,
  color: '#ffffff',
  x: { base: 0, random: 270 },
  y: { base: 0, slope: 0, spread: 400 },
  alpha: { base: 0.1, random: 0.1 },
};

describe('per-component random streams', () => {
  let h: Harness;
  const hashes = (s: Json, only: string[]): Promise<Hashes> =>
    h.page.evaluate(`(${HASH_COMPONENTS})(${JSON.stringify({ scene: s, ids: only, frames: FRAMES })})`) as Promise<Hashes>;

  beforeAll(async () => {
    h = await openHarness();
  }, 60_000);
  afterAll(async () => {
    await h?.close();
  });

  it('adding a component leaves every other component unchanged', async () => {
    const base = scene();
    const withExtra = scene();
    withExtra.layers[0]?.components.splice(1, 0, EXTRA);
    const all = ids(base);
    const [a, b] = await Promise.all([hashes(base, all), hashes(withExtra, all)]);
    expect(Object.keys(a)).toHaveLength(all.length * FRAMES.length);
    expect(b).toEqual(a);
    // The components that use randomness actually drew something.
    for (const id of ['milkyWay', 'starfield', 'ground', 'smoke', 'dust', 'grassTufts']) expect(a[`${id}@480`]).not.toMatch(/:empty$/);
  }, 60_000);

  it('removing a component leaves every other component unchanged', async () => {
    const base = scene();
    const without = scene();
    const backdrop = without.layers[0] as Json['layers'][number];
    backdrop.components = backdrop.components.filter((c) => c.id !== 'milkyWay');
    const remaining = ids(without);
    const [a, b] = await Promise.all([hashes(base, remaining), hashes(without, remaining)]);
    expect(b).toEqual(a);
  }, 60_000);

  it('control: a different scene seed does change the random components', async () => {
    const reseeded = { ...scene(), seed: 12 };
    const [a, b] = await Promise.all([hashes(scene(), ['starfield', 'sky']), hashes(reseeded, ['starfield', 'sky'])]);
    expect(b['starfield@480']).not.toBe(a['starfield@480']);
    expect(b['sky@480']).toBe(a['sky@480']); // no randomness in the sky
  }, 60_000);

});
