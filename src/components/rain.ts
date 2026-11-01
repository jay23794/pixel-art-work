import { Graphics } from 'pixi.js';
import { z } from 'zod';
import type { SceneComponent } from '../core/component.ts';
import { color, count, randomValue } from '../scene/primitives.ts';
import type { Actions, WithEvents } from './shared.ts';

const int = z.number().int();

export const params = z.strictObject({
  count,
  /** Area the drops wrap around in. */
  x: int,
  y: int,
  width: int.positive(),
  height: int.positive(),
  /** Fall speed in px/s (randomValue per drop). */
  speed: randomValue,
  /** Sideways drift per pixel fallen (legacy: x − y·0.1). */
  slant: z.number(),
  /** Streak length in px (1px wide). */
  length: int.positive(),
  color,
  /** Light cones (apex x/y, bottom, slope, base) that tint the drops inside them. */
  lit: z
    .array(z.strictObject({ x: z.number(), y: z.number(), bottom: z.number(), slope: z.number(), base: z.number(), color }))
    .default([]),
});
export const actions: Actions = {};
type Config = WithEvents<z.infer<typeof params>>;

interface Drop {
  x: number;
  y: number;
  sp: number;
}

/** Slanted rain streaks that wrap in their area; drops inside a light cone take its colour. rng per drop: (x, y, speed). */
export function rain(id: string): SceneComponent<Config> {
  let cfg!: Config;
  let g!: Graphics;
  const drops: Drop[] = [];
  return {
    id,
    build(config, rng) {
      cfg = config;
      for (let i = 0; i < cfg.count; i++)
        drops.push({ x: rng.next() * cfg.width, y: rng.next() * cfg.height, sp: cfg.speed.base + rng.next() * cfg.speed.random });
      g = new Graphics();
      return g;
    },
    update(ctx) {
      const { width, height } = cfg;
      g.clear();
      for (const d of drops) {
        const fy = Math.floor((d.y + ctx.t * d.sp) % height);
        const fx = (((Math.floor(d.x - fy * cfg.slant) % width) + width) % width);
        const x = cfg.x + fx,
          y = cfg.y + fy;
        const cone = cfg.lit.find((c) => y > c.y && y < c.bottom && Math.abs(x - c.x) < (y - c.y) * c.slope + c.base);
        g.rect(x, y, 1, cfg.length).fill(cone ? cone.color : cfg.color);
      }
    },
  };
}
