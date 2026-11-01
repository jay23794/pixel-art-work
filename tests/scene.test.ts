import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadScene, SceneValidationError, type SceneDef } from '../src/scene/loader.ts';

// The invalid-scene tests write deliberately wrong types into the JSON, so it is untyped here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

const raw = (): Json => JSON.parse(readFileSync(new URL('../scenes/desert-lab.json', import.meta.url), 'utf8'));

/** Loads a modified copy of desert-lab.json and returns the validation issues. */
function issuesFor(mutate: (s: Json) => void): { path: string; message: string }[] {
  const s = raw();
  mutate(s);
  try {
    loadScene(s);
  } catch (e) {
    if (e instanceof SceneValidationError) return [...e.issues];
    throw e;
  }
  throw new Error('expected the scene to be rejected');
}

const component = (def: SceneDef, id: string) => def.layers.flatMap((l) => l.components).find((c) => c.id === id);

describe('loadScene: scenes/desert-lab.json', () => {
  const def = loadScene(raw());

  it('loads with output size and a whole-number upscale', () => {
    expect(def.output).toMatchObject({ width: 1080, height: 1920, logicalWidth: 270, logicalHeight: 480, fps: 24, duration: 40, scale: 4 });
    expect(def.rng).toBe('legacy-lcg');
  });

  it('keeps layer and component order', () => {
    expect(def.layers.map((l) => l.id)).toEqual(['backdrop', 'camp', 'air', 'foreground', 'overlay']);
    expect(def.layers.flatMap((l) => l.components).map((c) => c.id)).toEqual([
      'sky', 'milkyWay', 'starfield', 'moon', 'shootingStar', 'farMesa', 'midMesa', 'dunes', 'ground', 'doorPool', 'bulbPool',
      'cactusLeft', 'cactusRight', 'trailer', 'generator', 'stringLights', 'props', 'smoke', 'dust', 'fgDune', 'grassTufts',
      'vignette', 'fade',
    ]);
  });

  it('resolves palette references to colours', () => {
    expect((component(def, 'props')?.params.shapes as { color: number }[])[2]?.color).toBe(0x000222);
    expect(component(def, 'moon')?.params.color).toBe(0xfff0d0);
  });

  it('applies defaults', () => {
    expect(def.layers[0]).toMatchObject({ space: 'world', x: 0, y: 0, parallax: 0 });
    expect(def.camera.keyframes[0]?.easing).toBe('linear');
    expect(component(def, 'bulbPool')?.params.light).toEqual({ base: 0.6, pulse: 0.4, envBase: 1, env: 0 });
  });

  it('attaches events to their target components, in file order', () => {
    expect(component(def, 'fade')?.events.map((e) => e.action)).toEqual(['fadeIn', 'fadeOut']);
    expect(component(def, 'stringLights')?.events.map((e) => [e.time, e.action])).toEqual([[2, 'lightsOn'], [36.2, 'lightsOff']]);
    expect(component(def, 'shootingStar')?.events.map((e) => e.params)).toEqual([{ x: 40, y: 60 }, { x: 150, y: 30 }]);
  });

  it('parses post effects in order', () => {
    expect(def.post).toEqual([
      { type: 'grade', params: { brightness: 0.9, envGain: 0.18, pulseGain: 0.06 } },
      { type: 'noise', params: { amount: 0.06, seed: 0.3, cycle: 13 } },
    ]);
  });
});

describe('loadScene: invalid scenes fail with the JSON path and a useful message', () => {
  it('bad type', () => {
    expect(issuesFor((s) => (s.seed = 'eleven'))).toEqual([{ path: 'seed', message: expect.stringMatching(/expected number/i) }]);
  });

  it('missing field', () => {
    expect(issuesFor((s) => delete s.output.fps)).toEqual([{ path: 'output.fps', message: expect.stringMatching(/expected number/i) }]);
  });

  it('non-integer upscale', () => {
    expect(issuesFor((s) => ((s.output.width = 405), (s.output.height = 720)))).toEqual([
      { path: 'output.width', message: 'upscale must be a whole number for crisp pixels: width/logicalWidth = 405/270 = 1.5' },
    ]);
  });

  it('different upscale per axis', () => {
    expect(issuesFor((s) => (s.output.height = 1900))).toEqual([
      { path: 'output.width', message: expect.stringContaining('same on both axes') },
    ]);
  });

  it('unknown component type', () => {
    expect(issuesFor((s) => (s.layers[0].components[1].type = 'sparkle'))).toEqual([
      { path: 'layers[0].components[1].type', message: expect.stringMatching(/unknown component type "sparkle" \(known: cactus, .*starfield/) },
    ]);
  });

  it('keyframe beyond duration', () => {
    expect(issuesFor((s) => (s.camera.keyframes[3].time = 45))).toEqual([
      { path: 'camera.keyframes[3].time', message: 'keyframe at 45s is beyond the scene duration (40s)' },
    ]);
  });

  it('keyframes out of order', () => {
    expect(issuesFor((s) => (s.camera.keyframes[2].time = 10))).toEqual([
      { path: 'camera.keyframes[2].time', message: expect.stringContaining('must increase') },
    ]);
  });

  it('missing component param', () => {
    expect(issuesFor((s) => delete s.layers[0].components[2].twinkle)).toEqual([
      { path: 'layers[0].components[2].twinkle', message: expect.stringMatching(/expected object/i) },
    ]);
  });

  it('unexpected component param', () => {
    expect(issuesFor((s) => (s.layers[1].components[0].wheels = 4))).toEqual([
      { path: 'layers[1].components[0]', message: expect.stringContaining('"wheels"') },
    ]);
  });

  it('unknown palette colour', () => {
    expect(issuesFor((s) => (s.layers[0].components[3].color = '$sun'))).toEqual([
      { path: 'layers[0].components[3].color', message: expect.stringContaining('unknown palette colour "$sun"') },
    ]);
  });

  it('duplicate component id', () => {
    expect(issuesFor((s) => (s.layers[2].components[0].id = 'smoke'))).toContainEqual({
      path: 'layers[2].components[0].id',
      message: 'duplicate component id "smoke"',
    });
  });

  it('event aimed at a missing component', () => {
    expect(issuesFor((s) => (s.events[1].target = 'lantern'))).toEqual([{ path: 'events[1].target', message: 'no component with id "lantern"' }]);
  });

  it('event action the target does not support', () => {
    expect(issuesFor((s) => (s.events[1].target = 'sky'))).toEqual([
      { path: 'events[1].action', message: 'component "sky" (sky) has no action "lightsOn" (supports: none)' },
    ]);
  });

  it('event beyond duration', () => {
    expect(issuesFor((s) => (s.events[0].time = 41))).toEqual([{ path: 'events[0].time', message: 'event at 41s is beyond the scene duration (40s)' }]);
  });

  it('unknown post effect', () => {
    expect(issuesFor((s) => s.post.push({ type: 'bloom' }))).toEqual([
      { path: 'post[2].type', message: 'unknown post effect "bloom" (known: grade, noise)' },
    ]);
  });

  it('reports every problem at once, in the error message too', () => {
    const s = raw();
    s.seed = 'x';
    s.output.fps = -1;
    expect(() => loadScene(s, 'scenes/broken.json')).toThrow(/Invalid scenes\/broken\.json:\n {2}seed: .*\n {2}output\.fps: /);
  });
});
