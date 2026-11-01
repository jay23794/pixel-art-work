import { Graphics } from 'pixi.js';
import { z } from 'zod';
import type { SceneComponent } from '../core/component.ts';
import { color, numberOrSignal } from '../scene/primitives.ts';
import { read, type Actions, type WithEvents } from './shared.ts';

export const params = z.strictObject({
  /** Centre and radii of the elliptical falloff. */
  x: z.number(),
  y: z.number(),
  rx: z.number().positive(),
  ry: z.number().positive(),
  color,
  /** Added light at full strength: colour × alpha × level. */
  alpha: z.number().min(0).max(1),
  /** Strength (1 − d)² is rounded to this many levels, so the glow has hard pixel-art rings. */
  levels: z.number().int().positive().default(4),
  level: numberOrSignal,
});
export const actions: Actions = {};
type Config = WithEvents<z.infer<typeof params>>;

/**
 * Additive radial glow quantised into flat rings, as in legacy/render.py:
 * round(clip(1 − d, 0, 1)² × levels) / levels, d = elliptical distance at the pixel.
 * Built once as row spans per ring; the level only changes the alpha.
 */
export function steppedGlow(id: string): SceneComponent<Config> {
  let cfg!: Config;
  let g!: Graphics;
  return {
    id,
    build(config) {
      cfg = config;
      const { x, y, rx, ry, levels } = cfg;
      g = new Graphics();
      g.blendMode = 'add';
      const step = cfg.alpha / levels;
      // Ring k covers pixels whose rounded strength is ≥ k/levels: (1 − d)² ≥ (k − ½)/levels.
      for (let k = 1; k <= levels; k++) {
        const dMax = 1 - Math.sqrt((k - 0.5) / levels);
        for (let py = Math.floor(y - ry * dMax); py <= Math.ceil(y + ry * dMax); py++) {
          const dy = (py - y) / ry;
          if (Math.abs(dy) >= dMax) continue;
          const half = rx * Math.sqrt(dMax * dMax - dy * dy);
          // Pixels px with |px − x| < half.
          const x0 = Math.floor(x - half) + 1,
            x1 = Math.ceil(x + half) - 1;
          if (x1 >= x0) g.rect(x0, py, x1 - x0 + 1, 1).fill({ color: cfg.color, alpha: step });
        }
      }
      return g;
    },
    update(ctx) {
      g.alpha = read(cfg.level, ctx);
    },
  };
}
