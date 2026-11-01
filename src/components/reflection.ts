import { Container, Graphics } from 'pixi.js';
import { z } from 'zod';
import type { SceneComponent } from '../core/component.ts';
import { color, numberOrSignal } from '../scene/primitives.ts';
import { read, type Actions, type WithEvents } from './shared.ts';

const int = z.number().int();

export const params = z.strictObject({
  /** Patch of wet ground. */
  x: int,
  y: int,
  width: int.positive(),
  height: int.positive(),
  /** Every `rowStep`-th row is wet: darkened by `darken`, then lit by the reflected colour. */
  rowStep: int.positive(),
  darken: z.number().min(0).max(1),
  /** Added light: colour × alpha × level on rows where (y + floor(t·rate)) mod period < on. */
  color,
  alpha: z.number().min(0).max(1),
  ripple: z.strictObject({ rate: z.number().nonnegative(), period: int.positive(), on: int.nonnegative() }),
  /** Brightness of the light being reflected, usually the same signal as the light. */
  level: numberOrSignal,
});
export const actions: Actions = {};
type Config = WithEvents<z.infer<typeof params>>;

/** A light's broken, rippling reflection on wet ground (legacy: img·0.7 + colour·0.12·br on striped rows). */
export function reflection(id: string): SceneComponent<Config> {
  let cfg!: Config;
  let lit!: Graphics;
  return {
    id,
    build(config) {
      cfg = config;
      const { x, y, width, height, rowStep } = cfg;
      const root = new Container();
      const wet = new Graphics();
      for (let ry = y; ry < y + height; ry += rowStep) wet.rect(x, ry, width, 1).fill({ color: 0x000000, alpha: cfg.darken });
      root.addChild(wet);
      lit = new Graphics();
      lit.blendMode = 'add';
      root.addChild(lit);
      return root;
    },
    update(ctx) {
      const { x, y, width, height, rowStep, ripple } = cfg;
      const alpha = cfg.alpha * read(cfg.level, ctx);
      const shift = Math.floor(ctx.t * ripple.rate);
      lit.clear();
      for (let ry = y; ry < y + height; ry += rowStep)
        if ((ry + shift) % ripple.period < ripple.on) lit.rect(x, ry, width, 1).fill({ color: cfg.color, alpha });
    },
  };
}
