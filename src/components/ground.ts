import { Graphics } from 'pixi.js';
import { z } from 'zod';
import { parallaxX } from '../camera/camera.ts';
import type { SceneComponent } from '../core/component.ts';
import { color, count, parallax, randomValue } from '../scene/primitives.ts';
import type { Actions, WithEvents } from './shared.ts';

export const params = z.strictObject({
  x: z.number(),
  width: z.number().positive(),
  bands: z.array(z.strictObject({ y: z.number(), height: z.number().positive(), color })).min(1),
  specks: z.strictObject({ count, color, alpha: z.number().min(0).max(1), x: randomValue, y: randomValue }),
  parallax,
});
export const actions: Actions = {};
type Config = WithEvents<z.infer<typeof params>>;

/** Banded sand with scattered specks. rng per speck: (x, y). */
export function ground(id: string): SceneComponent<Config> {
  let g!: Graphics;
  let factor = 0;
  return {
    id,
    build(cfg, rng) {
      factor = cfg.parallax;
      g = new Graphics();
      for (const b of cfg.bands) g.rect(cfg.x, b.y, cfg.width, b.height).fill(b.color);
      const s = cfg.specks;
      for (let i = 0; i < s.count; i++)
        g.rect(Math.round(s.x.base + rng.next() * s.x.random), Math.round(s.y.base + rng.next() * s.y.random), 1, 1).fill({
          color: s.color,
          alpha: s.alpha,
        });
      return g;
    },
    update(ctx) {
      g.x = parallaxX(ctx.camera, factor);
    },
  };
}
