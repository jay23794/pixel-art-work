import { Sprite, Texture } from 'pixi.js';
import { z } from 'zod';
import type { SceneComponent } from '../core/component.ts';
import { color } from '../scene/primitives.ts';
import type { Actions, WithEvents } from './shared.ts';

export const params = z.strictObject({
  color,
  /** Centre as fractions of width/height; radii as fractions of height. */
  cx: z.number(),
  cy: z.number(),
  inner: z.number().nonnegative(),
  outer: z.number().positive(),
  /** Edge opacity (transparent at the inner radius). */
  alpha: z.number().min(0).max(1),
});
export const actions: Actions = {};
type Config = WithEvents<z.infer<typeof params>>;

/** Radial darkening towards the edges. Static; meant for a screen layer. */
export function vignette(id: string): SceneComponent<Config> {
  return {
    id,
    build(cfg, _rng, ctx0) {
      const W = ctx0.width,
        H = ctx0.height;
      const vc = document.createElement('canvas');
      vc.width = W;
      vc.height = H;
      const vx = vc.getContext('2d');
      if (!vx) throw new Error('vignette: 2D canvas context unavailable');
      const rgb = `${cfg.color >> 16},${(cfg.color >> 8) & 255},${cfg.color & 255}`;
      const rg = vx.createRadialGradient(W * cfg.cx, H * cfg.cy, H * cfg.inner, W * cfg.cx, H * cfg.cy, H * cfg.outer);
      rg.addColorStop(0, `rgba(${rgb},0)`);
      rg.addColorStop(1, `rgba(${rgb},${cfg.alpha})`);
      vx.fillStyle = rg;
      vx.fillRect(0, 0, W, H);
      return new Sprite(Texture.from(vc));
    },
    update() {},
  };
}
