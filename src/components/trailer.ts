import { BlurFilter, Container, Graphics } from 'pixi.js';
import { z } from 'zod';
import type { SceneComponent } from '../core/component.ts';
import { color, lightCurve, shape } from '../scene/primitives.ts';
import { drawShapes, lightLevel, lit, mix, noParams, type Actions, type WithEvents } from './shared.ts';

const litColor = z.strictObject({ off: color, on: color });

export const params = z.strictObject({
  /** Static body art, drawn first. */
  body: z.array(shape),
  windows: z.strictObject({ at: z.array(z.tuple([z.number(), z.number()])), w: z.number(), h: z.number(), r: z.number(), ...litColor.shape }),
  door: z.strictObject({
    frame: shape,
    panel: z.strictObject({ x: z.number(), y: z.number(), w: z.number(), h: z.number(), ...litColor.shape }),
    trim: shape,
  }),
  glow: z.strictObject({
    at: z.array(z.tuple([z.number(), z.number()])),
    radius: z.number().positive(),
    color,
    alpha: z.number().min(0).max(1),
    blur: z.strictObject({ strength: z.number(), quality: z.number().int().positive() }),
  }),
  /** Window/door light level; colours blend off → on by it. */
  light: lightCurve,
});
export const actions: Actions = { lightsOn: noParams, lightsOff: noParams };
type Config = WithEvents<z.infer<typeof params>>;

/** Camper with windows and door that glow with the light level, plus an additive glow. */
export function trailer(id: string): SceneComponent<Config> {
  let cfg!: Config;
  let win!: Graphics;
  let door!: Graphics;
  let winGlow!: Graphics;
  return {
    id,
    build(config) {
      cfg = config;
      const root = new Container();
      const tr = new Graphics();
      drawShapes(tr, cfg.body);
      root.addChild(tr);
      win = new Graphics();
      root.addChild(win);
      door = new Graphics();
      root.addChild(door);
      winGlow = new Graphics();
      winGlow.filters = [new BlurFilter({ strength: cfg.glow.blur.strength, quality: cfg.glow.blur.quality })];
      winGlow.blendMode = 'add';
      root.addChild(winGlow);
      return root;
    },
    update(ctx) {
      const lw = lightLevel(cfg.light, ctx, lit(cfg.events, ctx.t));
      const { windows: w, door: d, glow } = cfg;
      win.clear();
      for (const [x, y] of w.at) win.roundRect(x, y, w.w, w.h, w.r).fill(mix(w.off, w.on, lw));
      door.clear();
      drawShapes(door, [d.frame]);
      door.rect(d.panel.x, d.panel.y, d.panel.w, d.panel.h).fill(mix(d.panel.off, d.panel.on, lw));
      drawShapes(door, [d.trim]);
      winGlow.clear();
      for (const [x, y] of glow.at) winGlow.circle(x, y, glow.radius).fill({ color: glow.color, alpha: glow.alpha * lw });
    },
  };
}
