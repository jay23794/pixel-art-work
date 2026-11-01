import { Container, Graphics } from 'pixi.js';
import { z } from 'zod';
import type { SceneComponent } from '../core/component.ts';
import { color, count, randomValue } from '../scene/primitives.ts';
import type { Actions, WithEvents } from './shared.ts';

export const params = z.strictObject({
  count,
  x: randomValue,
  phase: randomValue,
  /** Blades k = −blades..blades: (x + k·rootSpread, groundY) → (x + k·tipSpread + sway, tipY + |k|·tipDrop). */
  blades: z.number().int().nonnegative(),
  groundY: z.number(),
  tipY: z.number(),
  rootSpread: z.number(),
  tipSpread: z.number(),
  tipDrop: z.number(),
  /** sway = round(sin(t·speed + phase) × amount) */
  sway: z.strictObject({ speed: z.number(), amount: z.number() }),
  width: z.number().positive(),
  color,
});
export const actions: Actions = {};
type Config = WithEvents<z.infer<typeof params>>;

interface Tuft {
  g: Graphics;
  x: number;
  ph: number;
}

/** Swaying grass tufts. rng per tuft: (x, phase). */
export function grassTufts(id: string): SceneComponent<Config> {
  let cfg!: Config;
  const TUFTS: Tuft[] = [];
  return {
    id,
    build(config, rng) {
      cfg = config;
      const root = new Container();
      for (let i = 0; i < cfg.count; i++) {
        const g = new Graphics();
        root.addChild(g);
        const x = cfg.x.base + rng.next() * cfg.x.random;
        const ph = cfg.phase.base + rng.next() * cfg.phase.random;
        TUFTS.push({ g, x, ph });
      }
      return root;
    },
    update(ctx) {
      const { t } = ctx;
      const c = cfg;
      for (const u of TUFTS) {
        const s = Math.round(Math.sin(t * c.sway.speed + u.ph) * c.sway.amount);
        u.g.clear();
        for (let k = -c.blades; k <= c.blades; k++)
          u.g
            .moveTo(u.x + k * c.rootSpread, c.groundY)
            .lineTo(u.x + k * c.tipSpread + s, c.tipY + Math.abs(k) * c.tipDrop)
            .stroke({ width: c.width, color: c.color });
      }
    },
  };
}
