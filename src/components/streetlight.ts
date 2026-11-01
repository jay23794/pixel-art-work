import { Container, Graphics } from 'pixi.js';
import { z } from 'zod';
import type { SceneComponent } from '../core/component.ts';
import { color, numberOrSignal } from '../scene/primitives.ts';
import { mix, read, type Actions, type WithEvents } from './shared.ts';

const int = z.number().int();

/** Pixels with |px − cx| < half, as [x0, width] (empty → width ≤ 0). */
const span = (cx: number, half: number): [number, number] => {
  const x0 = Math.floor(cx - half) + 1;
  return [x0, Math.ceil(cx + half) - x0];
};

export const params = z.strictObject({
  /** Pole: x, top and bottom (ground) y, width. */
  pole: z.strictObject({ x: int, top: int, bottom: int, width: int.positive(), color }),
  /** Arm from x to the pole, just above the pole's top. */
  arm: z.strictObject({ x: int, height: int.positive() }),
  /** Lamp head (lit colour × level); the cone hangs from its centre. */
  lamp: z.strictObject({ x: int, y: int, width: int.positive(), height: int.positive(), color }),
  /** Additive light: rows from the lamp to `bottom`, |x − centre| < (y − top)·slope + base. */
  cone: z.strictObject({ bottom: int, slope: z.number().nonnegative(), base: z.number().nonnegative(), alpha: z.number().min(0).max(1) }),
  /** Additive ellipse of light on the ground. */
  pool: z.strictObject({ y: z.number(), rx: z.number().positive(), ry: z.number().positive(), alpha: z.number().min(0).max(1) }),
  /** Lamp brightness, usually a signal. */
  level: numberOrSignal,
});
export const actions: Actions = {};
type Config = WithEvents<z.infer<typeof params>>;

/** The cone's apex: centre x and top y. */
const coneApex = (cfg: Pick<z.infer<typeof params>, 'lamp'>): { x: number; y: number } => ({
  x: cfg.lamp.x + cfg.lamp.width / 2,
  y: cfg.lamp.y + cfg.lamp.height,
});

/** A street lamp with a hard-edged light cone and a pool on the ground (legacy streetlight scene). */
export function streetlight(id: string): SceneComponent<Config> {
  let cfg!: Config;
  let head!: Graphics;
  let light!: Graphics;
  return {
    id,
    build(config) {
      cfg = config;
      const { pole, arm, lamp, cone, pool } = cfg;
      const root = new Container();
      const body = new Graphics();
      body.rect(pole.x, pole.top, pole.width, pole.bottom - pole.top).fill(pole.color);
      body.rect(arm.x, pole.top - arm.height, pole.x + pole.width - arm.x, arm.height).fill(pole.color);
      root.addChild(body);

      const apex = coneApex(cfg);
      light = new Graphics();
      light.blendMode = 'add';
      for (let y = apex.y + 1; y < cone.bottom; y++) {
        const [x0, w] = span(apex.x, (y - apex.y) * cone.slope + cone.base);
        if (w > 0) light.rect(x0, y, w, 1).fill({ color: lamp.color, alpha: cone.alpha });
      }
      for (let y = Math.floor(pool.y - pool.ry); y <= Math.ceil(pool.y + pool.ry); y++) {
        const dy = (y - pool.y) / pool.ry;
        if (Math.abs(dy) >= 1) continue;
        const [x0, w] = span(apex.x, pool.rx * Math.sqrt(1 - dy * dy));
        if (w > 0) light.rect(x0, y, w, 1).fill({ color: lamp.color, alpha: pool.alpha });
      }
      root.addChild(light);
      head = new Graphics();
      root.addChild(head);
      return root;
    },
    update(ctx) {
      const level = read(cfg.level, ctx);
      const { lamp } = cfg;
      head.clear();
      head.rect(lamp.x, lamp.y, lamp.width, lamp.height).fill(mix(0, lamp.color, level));
      light.alpha = level;
    },
  };
}
