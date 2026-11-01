import { Graphics } from 'pixi.js';
import { z } from 'zod';
import { parallaxX } from '../camera/camera.ts';
import type { SceneComponent } from '../core/component.ts';
import { color, count, parallax, randomValue } from '../scene/primitives.ts';
import type { Actions, WithEvents } from './shared.ts';

export const params = z.strictObject({
  count,
  color,
  x: randomValue,
  /** y = base + x × slope + (rng − 0.5) × spread */
  y: z.strictObject({ base: z.number(), slope: z.number(), spread: z.number() }),
  alpha: randomValue,
  parallax,
});
export const actions: Actions = {};
type Config = WithEvents<z.infer<typeof params>>;

/** Diagonal band of faint dots. rng per dot: (x, y, alpha). */
export function milkyWay(id: string): SceneComponent<Config> {
  let g!: Graphics;
  let factor = 0;
  return {
    id,
    build(cfg, rng) {
      factor = cfg.parallax;
      g = new Graphics();
      for (let i = 0; i < cfg.count; i++) {
        const x = cfg.x.base + rng.next() * cfg.x.random,
          y = cfg.y.base + x * cfg.y.slope + (rng.next() - 0.5) * cfg.y.spread;
        g.rect(Math.round(x), Math.round(y), 1, 1).fill({ color: cfg.color, alpha: cfg.alpha.base + rng.next() * cfg.alpha.random });
      }
      return g;
    },
    update(ctx) {
      g.x = parallaxX(ctx.camera, factor);
    },
  };
}
