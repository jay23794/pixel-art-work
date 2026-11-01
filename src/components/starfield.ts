import { Container, Graphics } from 'pixi.js';
import { z } from 'zod';
import { parallaxX } from '../camera/camera.ts';
import type { SceneComponent } from '../core/component.ts';
import { color, count, randomValue } from '../scene/primitives.ts';
import type { Actions, WithEvents } from './shared.ts';

export const params = z.strictObject({
  color,
  /** One parallax layer each. With bigChance, each star first rolls rng < bigChance for a cross shape. */
  layers: z.array(z.strictObject({ count, parallax: z.number(), bigChance: z.number().min(0).max(1).optional() })).min(1),
  bigAlpha: z.number().min(0).max(1),
  x: randomValue,
  y: randomValue,
  phase: randomValue,
  speed: randomValue,
  /** alpha = min + range × (0.5 + 0.5·sin(t·speed + phase)) */
  twinkle: z.strictObject({ min: z.number(), range: z.number() }),
});
export const actions: Actions = {};
type Config = WithEvents<z.infer<typeof params>>;

interface Star {
  g: Graphics;
  ph: number;
  sp: number;
}

/** Parallax layers of twinkling stars. rng per star: ([big], x, y, phase, speed). */
export function starfield(id: string): SceneComponent<Config> {
  const layers: { c: Container; stars: Star[]; f: number }[] = [];
  let twinkle!: Config['twinkle'];
  return {
    id,
    build(cfg, rng) {
      twinkle = cfg.twinkle;
      const root = new Container();
      for (const layer of cfg.layers) {
        const c = new Container();
        const stars: Star[] = [];
        for (let i = 0; i < layer.count; i++) {
          const g = new Graphics();
          const big = layer.bigChance !== undefined && rng.next() < layer.bigChance;
          g.rect(0, 0, 1, 1).fill(cfg.color);
          if (big) {
            g.rect(-1, 0, 3, 1).fill({ color: cfg.color, alpha: cfg.bigAlpha });
            g.rect(0, -1, 1, 3).fill({ color: cfg.color, alpha: cfg.bigAlpha });
          }
          g.x = Math.round(cfg.x.base + rng.next() * cfg.x.random);
          g.y = Math.round(cfg.y.base + rng.next() * cfg.y.random);
          const ph = cfg.phase.base + rng.next() * cfg.phase.random;
          const sp = cfg.speed.base + rng.next() * cfg.speed.random;
          c.addChild(g);
          stars.push({ g, ph, sp });
        }
        root.addChild(c);
        layers.push({ c, stars, f: layer.parallax });
      }
      return root;
    },
    update(ctx) {
      const { t } = ctx;
      for (const { c, stars, f } of layers) {
        c.x = parallaxX(ctx.camera, f);
        for (const s of stars) s.g.alpha = twinkle.min + twinkle.range * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
      }
    },
  };
}
