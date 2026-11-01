import { BlurFilter, Container, Graphics } from 'pixi.js';
import { z } from 'zod';
import type { SceneComponent } from '../core/component.ts';
import { color, numberOrSignal } from '../scene/primitives.ts';
import { mix, read, type Actions, type WithEvents } from './shared.ts';

const litColors = { off: color, on: color };

export const params = z.strictObject({
  /** Panes whose colour blends off → on by the light level, drawn in order. */
  panes: z.array(
    z.discriminatedUnion('type', [
      z.strictObject({ type: z.literal('rect'), x: z.number(), y: z.number(), w: z.number(), h: z.number(), ...litColors }),
      z.strictObject({ type: z.literal('roundRect'), x: z.number(), y: z.number(), w: z.number(), h: z.number(), r: z.number(), ...litColors }),
    ]),
  ),
  /** Additive blurred glow; alpha × level. */
  glow: z.strictObject({
    at: z.array(z.tuple([z.number(), z.number()])),
    radius: z.number().positive(),
    color,
    alpha: z.number().min(0).max(1),
    blur: z.strictObject({ strength: z.number(), quality: z.number().int().positive() }),
  }),
  /** Light level, usually a signal. */
  level: numberOrSignal,
});
export const actions: Actions = {};
type Config = WithEvents<z.infer<typeof params>>;

/** Lit windows/doors with an additive glow (e.g. the trailer's). */
export function windowLights(id: string): SceneComponent<Config> {
  let cfg!: Config;
  let panes!: Graphics;
  let glow!: Graphics;
  return {
    id,
    build(config) {
      cfg = config;
      const root = new Container();
      panes = new Graphics();
      root.addChild(panes);
      glow = new Graphics();
      glow.filters = [new BlurFilter({ strength: cfg.glow.blur.strength, quality: cfg.glow.blur.quality })];
      glow.blendMode = 'add';
      root.addChild(glow);
      return root;
    },
    update(ctx) {
      const lw = read(cfg.level, ctx);
      panes.clear();
      for (const p of cfg.panes) {
        if (p.type === 'roundRect') panes.roundRect(p.x, p.y, p.w, p.h, p.r);
        else panes.rect(p.x, p.y, p.w, p.h);
        panes.fill(mix(p.off, p.on, lw));
      }
      const gl = cfg.glow;
      glow.clear();
      for (const [x, y] of gl.at) glow.circle(x, y, gl.radius).fill({ color: gl.color, alpha: gl.alpha * lw });
    },
  };
}
