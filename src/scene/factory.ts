import type { AssetDef } from '../assets/contract.ts';
import { preloadAssets } from '../assets/preload.ts';
import { createApp, type PixelForgeApp } from '../core/app.ts';
import type { SceneDef } from './loader.ts';
import { COMPONENTS, POST_EFFECTS } from './registry.ts';

/**
 * Builds a runnable scene from a loaded SceneDef. All asset textures are loaded
 * first, so nothing renders before they are ready. Then layers and components in file
 * order (which is also the draw order), then the post effects as the world's
 * filters. Each component draws from its own random stream (see core/app.ts).
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
    signals: def.signals,
    background: o.backgroundColor,
  });

  const usedAssets = new Map<string, AssetDef>();
  for (const c of def.layers.flatMap((l) => l.components)) {
    const a = c.params.assetDef as AssetDef | undefined;
    if (a) usedAssets.set(a.id, a);
  }
  const textures = await preloadAssets([...usedAssets.values()]);

  for (const l of def.layers) {
    const layer = app.addLayer({ space: l.space, x: l.x, y: l.y, parallax: l.parallax });
    for (const c of l.components) {
      const type = COMPONENTS[c.type];
      if (!type) throw new Error(`unknown component type "${c.type}"`); // loadScene already rejects this
      const assetId = (c.params.assetDef as AssetDef | undefined)?.id;
      const config = assetId === undefined ? { ...c.params, events: c.events } : { ...c.params, events: c.events, textures: textures.get(assetId) };
      app.add(type.create(c.id), config as never, { layer });
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
