import { Graphics } from 'pixi.js';
import { z } from 'zod';
import type { SceneComponent } from '../core/component.ts';
import { color } from '../scene/primitives.ts';
import type { Actions, WithEvents } from './shared.ts';

const arm = z.strictObject({
  /** Arm joins the trunk at y − h × at. */
  at: z.number(),
  /** Horizontal part: (x + dx, joinY, w × h). */
  dx: z.number(),
  w: z.number(),
  h: z.number(),
  /** Upright part: (x + upDx, joinY − rise, upW × upH). */
  upDx: z.number(),
  rise: z.number(),
  upW: z.number(),
  upH: z.number(),
});

export const params = z.strictObject({
  /** Trunk left edge and ground line. */
  x: z.number(),
  y: z.number(),
  h: z.number().positive(),
  trunkWidth: z.number().positive(),
  arms: z.array(arm),
  color,
});
export const actions: Actions = {};
type Config = WithEvents<z.infer<typeof params>>;

/** Saguaro silhouette. Static. */
export function cactus(id: string): SceneComponent<Config> {
  return {
    id,
    build({ x, y, h, trunkWidth, arms, color: col }) {
      const g = new Graphics();
      g.rect(x, y - h, trunkWidth, h).fill(col);
      for (const a of arms) {
        g.rect(x + a.dx, y - h * a.at, a.w, a.h).fill(col);
        g.rect(x + a.upDx, y - h * a.at - a.rise, a.upW, a.upH).fill(col);
      }
      return g;
    },
    update() {},
  };
}
