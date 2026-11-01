import { Graphics } from 'pixi.js';
import { z } from 'zod';
import type { SceneComponent } from '../core/component.ts';
import { color, count } from '../scene/primitives.ts';
import type { Actions, WithEvents } from './shared.ts';

export const params = z.strictObject({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  /** Tile columns spread out from this x, so the floor reads as receding. */
  vanishX: z.number(),
  /** Size of the first (farthest) row; each row is `grow` × the previous one. */
  tile: z.strictObject({ width: z.number().positive(), height: z.number().positive(), grow: z.number().min(1) }),
  colors: z.tuple([color, color]),
  grout: color,
  /** Scattered highlight pixels. rng per speck: (x, y). */
  specks: z.strictObject({ count, color, alpha: z.number().min(0).max(1) }).optional(),
});
export const actions: Actions = {};
type Config = WithEvents<z.infer<typeof params>>;

/** Checkered tiles in rows that grow towards the viewer. Static. */
export function floor(id: string): SceneComponent<Config> {
  return {
    id,
    build(cfg, rng) {
      const { x, y, width, height, vanishX, tile } = cfg;
      const g = new Graphics();
      const right = x + width,
        bottom = y + height;
      let top = y,
        h = tile.height;
      for (let row = 0; top < bottom; row++) {
        const y0 = Math.round(top),
          y1 = Math.min(bottom, Math.round(top + h));
        const w = tile.width * (h / tile.height);
        // Column k spans vanishX + k·w … vanishX + (k + 1)·w; enough columns to cover both edges.
        const k0 = Math.floor((x - vanishX) / w),
          k1 = Math.ceil((right - vanishX) / w);
        for (let k = k0; k < k1; k++) {
          const x0 = Math.max(x, Math.round(vanishX + k * w)),
            x1 = Math.min(right, Math.round(vanishX + (k + 1) * w));
          if (x1 > x0 && y1 > y0) g.rect(x0, y0, x1 - x0, y1 - y0).fill(cfg.colors[(((k + row) % 2) + 2) % 2] as number);
          if (x0 > x) g.rect(x0, y0, 1, y1 - y0).fill(cfg.grout);
        }
        g.rect(x, y0, width, 1).fill(cfg.grout);
        top += h;
        h *= tile.grow;
      }
      if (cfg.specks) {
        const s = cfg.specks;
        for (let i = 0; i < s.count; i++)
          g.rect(Math.round(x + rng.next() * width), Math.round(y + 2 + rng.next() * (height - 2)), 1, 1).fill({ color: s.color, alpha: s.alpha });
      }
      return g;
    },
    update() {},
  };
}
