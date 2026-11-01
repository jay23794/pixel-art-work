import { Graphics } from 'pixi.js';
import { z } from 'zod';
import { parallaxX } from '../camera/camera.ts';
import type { SceneComponent } from '../core/component.ts';
import { color, parallax } from '../scene/primitives.ts';
import type { Actions, WithEvents } from './shared.ts';

export const params = z.strictObject({
  color,
  duration: z.number().positive(),
  /** Distance travelled over the duration. */
  dx: z.number(),
  dy: z.number(),
  /** Trail length in dots and the offset between dots. */
  length: z.number().int().positive(),
  stepX: z.number(),
  stepY: z.number(),
  parallax,
});
/** launch: start a streak at (x, y) at the event time. */
export const actions: Actions = { launch: z.strictObject({ x: z.number(), y: z.number() }) };
type Config = WithEvents<z.infer<typeof params>>;

/** Shooting stars, one per launch event. */
export function shootingStar(id: string): SceneComponent<Config> {
  let g!: Graphics;
  let cfg!: Config;
  let launches: { s: number; sx: number; sy: number }[] = [];
  return {
    id,
    build(config) {
      cfg = config;
      launches = config.events
        .filter((e) => e.action === 'launch')
        .map((e) => ({ s: e.time, sx: e.params.x as number, sy: e.params.y as number }));
      g = new Graphics();
      return g;
    },
    update(ctx) {
      const { t } = ctx;
      g.clear();
      for (const { s, sx, sy } of launches) {
        const a = (t - s) / cfg.duration;
        if (a > 0 && a < 1) {
          const x = sx + a * cfg.dx,
            y = sy + a * cfg.dy;
          for (let k = 0; k < cfg.length; k++)
            g.rect(Math.round(x - k * cfg.stepX), Math.round(y - k * cfg.stepY), 1, 1).fill({
              color: cfg.color,
              alpha: (1 - k / cfg.length) * (1 - a),
            });
        }
      }
      g.x = parallaxX(ctx.camera, cfg.parallax);
    },
  };
}
