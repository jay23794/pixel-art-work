import { Assets, Rectangle, Texture } from 'pixi.js';
import type { AssetDef } from './contract.ts';
import { bundledAssetUrls } from './registry.ts';

/**
 * Loads every asset's image (nearest-neighbour sampling) and cuts its frames.
 * Resolves only when all textures are ready, so frame 0 never renders before them.
 */
export async function preloadAssets(defs: readonly AssetDef[], urls = bundledAssetUrls()): Promise<Map<string, Texture[]>> {
  const out = new Map<string, Texture[]>();
  await Promise.all(
    defs.map(async (def) => {
      const url = urls[def.src];
      if (!url) throw new Error(`asset "${def.id}": image ${def.src} not found next to assets/sprites/${def.id}.json`);
      const base = await Assets.load<Texture>(url);
      base.source.scaleMode = 'nearest';
      const frames = def.frames.map((f, i) => {
        if (f.x + def.width > base.width || f.y + def.height > base.height) {
          throw new Error(`asset "${def.id}": frame ${i} (${def.width}×${def.height} at ${f.x},${f.y}) is outside ${def.src} (${base.width}×${base.height})`);
        }
        return new Texture({ source: base.source, frame: new Rectangle(f.x, f.y, def.width, def.height) });
      });
      out.set(def.id, frames);
    }),
  );
  return out;
}
