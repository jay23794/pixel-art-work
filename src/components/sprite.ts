import { Sprite, type Texture } from 'pixi.js';
import { z } from 'zod';
import { parallaxX } from '../camera/camera.ts';
import type { AssetDef } from '../assets/contract.ts';
import type { SceneComponent } from '../core/component.ts';
import { parallax } from '../scene/primitives.ts';
import type { Actions, WithEvents } from './shared.ts';

export const params = z.strictObject({
  /** Asset id (assets/sprites/<id>.json). */
  asset: z.string(),
  /** Where the asset's anchor lands (whole pixels). */
  x: z.number().int(),
  y: z.number().int(),
  parallax,
  /** Animations: offset into the loop, in steps of 1/fps. */
  phase: z.number().int().default(0),
  /** Animations: false holds the last frame after one play-through. */
  loop: z.boolean().default(true),
});
export const actions: Actions = {};
/** The loader attaches the validated asset; the factory attaches its preloaded frame textures. */
type Config = WithEvents<z.infer<typeof params>> & { readonly assetDef: AssetDef; readonly textures: readonly Texture[] };

/** Frame index for an animation at frame n of a scene running at sceneFps. Integer maths, so boundaries are exact. */
export function animationFrame(def: AssetDef, n: number, sceneFps: number, phase = 0, loop = true): number {
  if (def.frames.length === 1 || def.fps === undefined) return 0;
  const total = def.frames.reduce((s, f) => s + f.duration, 0);
  let step = Math.floor((n * def.fps) / sceneFps) + phase;
  step = loop ? ((step % total) + total) % total : Math.min(Math.max(step, 0), total - 1);
  for (let i = 0; i < def.frames.length; i++) {
    step -= (def.frames[i] as AssetDef['frames'][number]).duration;
    if (step < 0) return i;
  }
  return def.frames.length - 1;
}

/** Places a sprite or animation asset. */
export function sprite(id: string): SceneComponent<Config> {
  let s!: Sprite;
  let cfg!: Config;
  let x0 = 0;
  return {
    id,
    build(config) {
      cfg = config;
      x0 = cfg.x - cfg.assetDef.anchor.x;
      s = new Sprite(cfg.textures[0]);
      s.x = x0;
      s.y = cfg.y - cfg.assetDef.anchor.y;
      return s;
    },
    update(ctx) {
      if (cfg.textures.length > 1) s.texture = cfg.textures[animationFrame(cfg.assetDef, ctx.n, ctx.fps, cfg.phase, cfg.loop)] as Texture;
      if (cfg.parallax !== 0) s.x = x0 + parallaxX(ctx.camera, cfg.parallax);
    },
  };
}
