import { createApp, type PixelForgeApp } from '../core/app.ts';
import { createLegacyRng } from '../core/random.ts';
import type { SceneDef } from './loader.ts';
import { COMPONENTS, POST_EFFECTS } from './registry.ts';

/**
 * Builds a runnable scene from a loaded SceneDef: layers and components in file
 * order (which is also the draw order and, with rng "legacy-lcg", the order of
 * random draws), then the post effects as the world's filters.
 */
export async function createScene(def: SceneDef): Promise<PixelForgeApp> {
  const o = def.output;
  const app = await createApp({
    width: o.logicalWidth,
    height: o.logicalHeight,
    fps: o.fps,
    duration: o.duration,
    seed: def.seed,
    camera: def.camera,
    background: o.backgroundColor,
  });

  const shared = def.rng === 'legacy-lcg' ? createLegacyRng(def.seed) : undefined;
  for (const l of def.layers) {
    const layer = app.addLayer({ space: l.space, x: l.x, y: l.y, parallax: l.parallax });
    for (const c of l.components) {
      const type = COMPONENTS[c.type];
      if (!type) throw new Error(`unknown component type "${c.type}"`); // loadScene already rejects this
      app.add(type.create(c.id), { ...c.params, events: c.events } as never, shared ? { layer, rng: shared } : { layer });
    }
  }

  const effects = def.post.map(({ type, params }) => {
    const pt = POST_EFFECTS[type];
    if (!pt) throw new Error(`unknown post effect "${type}"`);
    return pt.create(params as never);
  });
  if (effects.length) app.world.filters = effects.map((e) => e.filter);
  app.onFrame((ctx) => {
    for (const e of effects) e.update(ctx);
  });

  return app;
}
