import { Graphics } from 'pixi.js';
import { z } from 'zod';
import type { SceneComponent } from '../core/component.ts';
import { color } from '../scene/primitives.ts';
import { durationParams, type Actions, type WithEvents } from './shared.ts';

export const params = z.strictObject({ color });
/** fadeIn: from full colour to clear over `duration`. fadeOut: from clear to full. Later events win. */
export const actions: Actions = { fadeIn: durationParams, fadeOut: durationParams };
type Config = WithEvents<z.infer<typeof params>>;

/** Full-screen colour fade driven by events. Meant for a screen layer. */
export function fade(id: string): SceneComponent<Config> {
  let g!: Graphics;
  let cfg!: Config;
  return {
    id,
    build(config, _rng, ctx0) {
      cfg = config;
      g = new Graphics();
      g.rect(0, 0, ctx0.width, ctx0.height).fill(cfg.color);
      return g;
    },
    update(ctx) {
      const { t } = ctx;
      let f = 0;
      for (const e of cfg.events) {
        const d = e.params.duration as number;
        if (e.action === 'fadeIn' && t < e.time + d) f = t < e.time ? 1 : 1 - (t - e.time) / d;
        if (e.action === 'fadeOut' && t > e.time) f = Math.min(1, (t - e.time) / d);
      }
      g.alpha = f;
    },
  };
}
