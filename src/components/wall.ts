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
  color,
  /** Vertical panel seams every `width` px, with a 1px highlight to their right. */
  panels: z.strictObject({ width: z.number().int().positive(), seam: color, highlight: color }).optional(),
  /** Horizontal rail, y relative to the wall's top. */
  rail: z.strictObject({ y: z.number().int(), height: z.number().int().positive(), color, shadow: color }).optional(),
  /** Strip along the bottom edge. */
  baseboard: z.strictObject({ height: z.number().int().positive(), color }).optional(),
  /** Faint rectangular marks. rng per stain: (x, y, w, h). */
  stains: z.strictObject({ count, color, alpha: z.number().min(0).max(1), maxSize: z.number().int().positive() }).optional(),
});
export const actions: Actions = {};
type Config = WithEvents<z.infer<typeof params>>;

/** A flat wall or ceiling: panels, rail, baseboard, stains. Static. */
export function wall(id: string): SceneComponent<Config> {
  return {
    id,
    build(cfg, rng) {
      const { x, y, width, height } = cfg;
      const g = new Graphics();
      g.rect(x, y, width, height).fill(cfg.color);
      if (cfg.stains) {
        const s = cfg.stains;
        for (let i = 0; i < s.count; i++) {
          const sx = Math.round(x + rng.next() * width),
            sy = Math.round(y + rng.next() * height);
          g.rect(sx, sy, rng.int(2, s.maxSize), rng.int(1, s.maxSize)).fill({ color: s.color, alpha: s.alpha });
        }
      }
      if (cfg.panels) {
        const p = cfg.panels;
        for (let px = x + p.width; px < x + width; px += p.width) {
          g.rect(px, y, 1, height).fill(p.seam);
          g.rect(px + 1, y, 1, height).fill(p.highlight);
        }
      }
      if (cfg.rail) {
        const r = cfg.rail;
        g.rect(x, y + r.y, width, r.height).fill(r.color);
        g.rect(x, y + r.y + r.height, width, 1).fill(r.shadow);
      }
      if (cfg.baseboard) g.rect(x, y + height - cfg.baseboard.height, width, cfg.baseboard.height).fill(cfg.baseboard.color);
      return g;
    },
    update() {},
  };
}
