import { Container, Graphics } from 'pixi.js';
import { z } from 'zod';
import { parallaxX } from '../camera/camera.ts';
import type { SceneComponent } from '../core/component.ts';
import { color, parallax } from '../scene/primitives.ts';
import type { Actions, WithEvents } from './shared.ts';

export const params = z.strictObject({
  x: z.number(),
  y: z.number(),
  radius: z.number().positive(),
  color,
  /** Disc drawn over the moon to cut the crescent. */
  shadow: z.strictObject({ x: z.number(), y: z.number(), radius: z.number().positive(), color }),
  glowColor: color,
  /** Glow rings, drawn in order. */
  glow: z.array(z.strictObject({ radius: z.number().positive(), alpha: z.number().min(0).max(1) })),
  parallax,
});
export const actions: Actions = {};
type Config = WithEvents<z.infer<typeof params>>;

/** Crescent moon with a soft glow. */
export function moon(id: string): SceneComponent<Config> {
  let c!: Container;
  let x = 0;
  let factor = 0;
  return {
    id,
    build(cfg) {
      x = cfg.x;
      factor = cfg.parallax;
      const glow = new Graphics();
      cfg.glow.forEach(({ radius, alpha }) => glow.circle(0, 0, radius).fill({ color: cfg.glowColor, alpha }));
      const disc = new Graphics();
      disc.circle(0, 0, cfg.radius).fill(cfg.color);
      disc.circle(cfg.shadow.x, cfg.shadow.y, cfg.shadow.radius).fill(cfg.shadow.color);
      c = new Container();
      c.addChild(glow, disc);
      c.x = cfg.x;
      c.y = cfg.y;
      return c;
    },
    update(ctx) {
      c.x = x + parallaxX(ctx.camera, factor);
    },
  };
}
