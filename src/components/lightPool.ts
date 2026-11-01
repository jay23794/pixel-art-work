import { Graphics } from 'pixi.js';
import { z } from 'zod';
import { parallaxX } from '../camera/camera.ts';
import type { SceneComponent } from '../core/component.ts';
import { color, lightCurve, parallax } from '../scene/primitives.ts';
import { lightLevel, lit, noParams, type Actions, type WithEvents } from './shared.ts';

export const params = z.strictObject({
  x: z.number(),
  y: z.number(),
  /** Ring k (rings → 1) has radii (rx + k·rxStep, ry + k·ryStep). */
  rings: z.number().int().positive(),
  rx: z.number(),
  rxStep: z.number(),
  ry: z.number(),
  ryStep: z.number(),
  color,
  /** Ring alpha = alpha × light level. */
  alpha: z.number().min(0).max(1),
  light: lightCurve,
  parallax,
});
export const actions: Actions = { lightsOn: noParams, lightsOff: noParams };
type Config = WithEvents<z.infer<typeof params>>;

/** Soft elliptical glow on the ground, drawn under the objects that cast it. */
export function lightPool(id: string): SceneComponent<Config> {
  let g!: Graphics;
  let cfg!: Config;
  return {
    id,
    build(config) {
      cfg = config;
      g = new Graphics();
      return g;
    },
    update(ctx) {
      const alpha = cfg.alpha * lightLevel(cfg.light, ctx, lit(cfg.events, ctx.t));
      g.clear();
      for (let k = cfg.rings; k >= 1; k--) g.ellipse(cfg.x, cfg.y, cfg.rx + k * cfg.rxStep, cfg.ry + k * cfg.ryStep).fill({ color: cfg.color, alpha });
      g.x = parallaxX(ctx.camera, cfg.parallax);
    },
  };
}
