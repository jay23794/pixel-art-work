import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from '../scripts/golden.ts';
import { readScene } from '../scripts/scene-render.ts';
import { loadScene, SceneValidationError, type SceneDef } from '../src/scene/loader.ts';
import { ENVIRONMENTS } from '../src/scene/registry.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

const lab = (): Json => readScene('laboratory');
const ids = (def: SceneDef): string[] => def.layers.flatMap((l) => l.components.map((c) => c.id));
const component = (def: SceneDef, id: string) => def.layers.flatMap((l) => l.components).find((c) => c.id === id);

function issuesFor(scene: Json): { path: string; message: string }[] {
  try {
    loadScene(scene);
  } catch (e) {
    if (e instanceof SceneValidationError) return [...e.issues];
    throw e;
  }
  throw new Error('expected the scene to be rejected');
}

describe('environment generators', () => {
  it('every generator ships a valid default palette', () => {
    for (const [type, gen] of Object.entries(ENVIRONMENTS))
      for (const [name, hex] of Object.entries(gen.palette)) expect(hex, `${type}.palette.${name}`).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('the desert and the laboratory load through the same loader', () => {
    expect(loadScene(readScene('desert-lab')).layers.map((l) => l.id)).toEqual(['backdrop', 'camp', 'air', 'foreground', 'overlay']);
    const def = loadScene(lab());
    expect(def.layers.map((l) => l.id)).toEqual(['room', 'bench', 'lights', 'overlay']);
    expect(ids(def)).toEqual(['ceiling', 'wall', 'window', 'floor', 'workbench', 'monitor1', 'monitor2', 'monitor3', 'light1', 'light2', 'vignette', 'fade']);
  });

  it('the rainy city loads through the same loader, with every effect wired to its signal', () => {
    const def = loadScene(readScene('rainy-city'));
    expect(def.layers.map((l) => l.id)).toEqual(['backdrop', 'street', 'light', 'weather', 'overlay']);
    expect(ids(def)).toEqual([
      'sky', 'farBlocks', 'blocks', 'street', 'neonSign', 'streetlight', 'neonGlow', 'neonReflection', 'lampReflection', 'rain', 'vignette', 'fade',
    ]);
    // The sign, its glow and its reflection flicker together; so do the lamp and its reflection.
    for (const id of ['neonSign', 'neonGlow', 'neonReflection']) expect(component(def, id)?.params.level).toBe('neon');
    for (const id of ['streetlight', 'lampReflection']) expect(component(def, id)?.params.level).toBe('lamp');
    expect(component(def, 'neonGlow')?.params.levels).toBe(4);
    expect(component(def, 'sky')?.params.steps).toBe(4);
    expect(def.signals.find(([n]) => n === 'neonFlicker')?.[1]).toEqual({ type: 'flicker', speed: 23, phase: 0, threshold: -0.85, dim: 0.25, pulseAbove: 0.5 });
  });

  it('the city layout comes from the seed', () => {
    const blocks = (seed: number) => {
      const def = loadScene({ ...readScene('rainy-city'), seed });
      return [component(def, 'farBlocks')?.params.blocks, component(def, 'blocks')?.params.blocks];
    };
    expect(blocks(23)).toEqual(blocks(23));
    expect(blocks(24)).not.toEqual(blocks(23));
  });

  it('rain inside the street lamp cone uses the cone geometry the lamp draws', () => {
    const def = loadScene(readScene('rainy-city'));
    const lamp = component(def, 'streetlight')?.params as { lamp: { x: number; y: number; width: number; height: number }; cone: { bottom: number; slope: number; base: number } };
    const [lit] = (component(def, 'rain')?.params as { lit: Record<string, number>[] }).lit;
    expect(lit).toMatchObject({ x: lamp.lamp.x + lamp.lamp.width / 2, y: lamp.lamp.y + lamp.lamp.height, bottom: lamp.cone.bottom, slope: lamp.cone.slope, base: lamp.cone.base });
  });

  it('passes scene signals through the config', () => {
    const def = loadScene(lab());
    expect(component(def, 'light1')?.params.power).toBe('mains');
    expect(component(def, 'monitor2')?.params.power).toBe('screens');
  });

  it('the scene palette overrides the generator default by name', () => {
    const s = lab();
    s.palette = { tileA: '#ff0000' };
    expect((component(loadScene(s), 'floor')?.params.colors as number[])[0]).toBe(0xff0000);
  });

  it('is deterministic for a seed, and the seed changes the layout', () => {
    const layout = (seed: number) => {
      const def = loadScene({ ...lab(), seed });
      return {
        monitors: ['monitor1', 'monitor2', 'monitor3'].map((id) => component(def, id)?.params).map((p) => [p?.mode, p?.x, p?.width]),
        glassware: component(def, 'workbench')?.params.items,
        flicker: ['light1', 'light2'].map((id) => component(def, id)?.params.flicker !== undefined),
      };
    };
    expect(layout(7)).toEqual(layout(7));
    expect(layout(8)).not.toEqual(layout(7));
  });

  it('config changes the structure', () => {
    const s = lab();
    Object.assign(s.environment, { monitors: 1, lights: 3, faultyLight: false });
    const def = loadScene(s);
    expect(ids(def).filter((id) => /^(monitor|light)\d$/.test(id))).toEqual(['monitor1', 'light1', 'light2', 'light3']);
    expect(def.layers.flatMap((l) => l.components).some((c) => c.params.flicker !== undefined)).toBe(false);
  });

  it('glassware never overlaps the monitors', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const def = loadScene({ ...lab(), seed });
      const screens = def.layers.flatMap((l) => l.components).filter((c) => c.type === 'monitor').map((c) => c.params as { x: number; width: number });
      for (const it of component(def, 'workbench')?.params.items as { x: number; width: number }[])
        for (const m of screens) expect(Math.abs(it.x - m.x), `seed ${seed}`).toBeGreaterThanOrEqual((it.width + m.width) / 2);
    }
  });
});

describe('environment errors name the JSON path', () => {
  it('unknown environment type', () => {
    expect(issuesFor({ ...lab(), environment: { type: 'jungle' } })).toEqual([
      { path: 'environment.type', message: 'unknown environment "jungle" (known: city, desert, laboratory)' },
    ]);
  });

  it('bad config', () => {
    const s = lab();
    s.environment.monitors = 9;
    expect(issuesFor(s)).toEqual([{ path: 'environment.monitors', message: expect.stringMatching(/too big/i) }]);
  });

  it('unknown signal in config', () => {
    const s = lab();
    s.environment.power.lights = '@generator';
    expect(issuesFor(s)).toEqual([{ path: 'environment.power.lights', message: 'unknown signal "@generator" (signals: mains, screens)' }]);
  });

  it('generated components are validated like hand-written ones', () => {
    const s = readScene('desert-lab') as Json;
    delete s.signals.bulbsOn; // the desert's string lights default to "@bulbsOn"
    expect(issuesFor(s)).toContainEqual({
      path: 'environment.layers[1].components[5].power',
      message: expect.stringContaining('unknown signal "@bulbsOn"'),
    });
  });

  it('a scene needs an environment or a layer', () => {
    const s = lab();
    delete s.environment;
    s.layers = [];
    expect(issuesFor(s)).toEqual([{ path: 'layers', message: 'a scene needs an environment or at least one layer' }]);
  });
});

describe('no scene-specific code in the engine', () => {
  // Scenes are data: environment names and their component ids may only appear in
  // src/components/ and scenes/. (The registry lists generators by name, like components.)
  const ENGINE = ['src/core', 'src/scene', 'src/camera', 'src/video', 'src/assets', 'src/main.ts'];
  const files = (p: string): string[] => {
    const abs = join(ROOT, p);
    if (p.endsWith('.ts')) return [abs];
    return readdirSync(abs, { withFileTypes: true }).flatMap((e) => files(join(p, e.name)));
  };

  it.each(ENGINE)('%s', (dir) => {
    for (const f of files(dir).filter((f) => !f.endsWith('src/scene/registry.ts'))) {
      const code = readFileSync(f, 'utf8').replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
      expect(code, relative(ROOT, f)).not.toMatch(/desert|laborator|trailer|cactus|monitor\d|workbench|rainy|neonSign|streetlight/i);
    }
  });
});
