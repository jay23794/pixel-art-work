import { Graphics } from 'pixi.js';
import { z } from 'zod';
import type { SceneComponent } from '../core/component.ts';
import { color, numberOrSignal } from '../scene/primitives.ts';
import { read, type Actions, type WithEvents } from './shared.ts';

export const params = z.strictObject({
  x: z.number(),
  y: z.number(),
  on: color,
  off: color,
  /** Lit during odd steps of floor(t × rate), while power is non-zero. */
  rate: z.number().positive(),
  power: numberOrSignal,
});
export const actions: Actions = {};
type Config = WithEvents<z.infer<typeof params>>;

/** A single blinking indicator pixel. */
export function led(id: string): SceneComponent<Config> {
  let cfg!: Config;
  let g!: Graphics;
  return {
    id,
    build(config) {
      cfg = config;
      g = new Graphics();
      return g;
    },
    update(ctx) {
      g.clear();
      g.rect(cfg.x, cfg.y, 1, 1).fill(Math.floor(ctx.t * cfg.rate) % 2 && read(cfg.power, ctx) ? cfg.on : cfg.off);
    },
  };
}
