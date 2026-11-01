import { Container, Graphics } from 'pixi.js';
import { z } from 'zod';
import type { SceneComponent } from '../core/component.ts';
import { color, numberOrSignal } from '../scene/primitives.ts';
import { mix, read, type Actions, type WithEvents } from './shared.ts';

const int = z.number().int();

export const params = z.strictObject({
  /** Unlit post the sign hangs on, drawn behind the tubes. */
  pole: z.strictObject({ x: int, top: int, bottom: int, width: int.positive(), color }).optional(),
  /** Straight tubes (frame, bars), drawn in order. */
  tubes: z.array(z.strictObject({ x: int, y: int, width: int.positive(), height: int.positive(), color })),
  /**
   * Diagonal arrow of `rows` rows, each `width` px wide and `step` px lower and to the
   * right of the one above. Row i is lit while (i + floor(t·rate)) mod period < on, else × dim.
   */
  arrow: z
    .strictObject({
      x: int,
      y: int,
      rows: int.positive(),
      width: int.positive(),
      step: int.positive(),
      color,
      chase: z.strictObject({ rate: z.number().nonnegative(), period: int.positive(), on: int.nonnegative(), dim: z.number().min(0).max(1) }),
    })
    .optional(),
  /** Tube brightness (colour × level), usually a flickering signal. */
  level: numberOrSignal,
});
export const actions: Actions = {};
type Config = WithEvents<z.infer<typeof params>>;

/** Lettering-free neon sign: tubes plus a chasing arrow (legacy motel sign). */
export function neonSign(id: string): SceneComponent<Config> {
  let cfg!: Config;
  let g!: Graphics;
  return {
    id,
    build(config) {
      cfg = config;
      const root = new Container();
      const p = cfg.pole;
      if (p) root.addChild(new Graphics().rect(p.x, p.top, p.width, p.bottom - p.top).fill(p.color));
      g = new Graphics();
      root.addChild(g);
      return root;
    },
    update(ctx) {
      const br = read(cfg.level, ctx);
      g.clear();
      for (const t of cfg.tubes) g.rect(t.x, t.y, t.width, t.height).fill(mix(0, t.color, br));
      const a = cfg.arrow;
      if (!a) return;
      const step = Math.floor(ctx.t * a.chase.rate);
      for (let i = 0; i < a.rows; i++) {
        const f = (i + step) % a.chase.period < a.chase.on ? 1 : a.chase.dim;
        g.rect(a.x + i * a.step, a.y + i * a.step, a.width, a.step).fill(mix(0, a.color, br * f));
      }
    },
  };
}
