import { BlurFilter, Container, Graphics } from 'pixi.js';
import { z } from 'zod';
import type { SceneComponent } from '../core/component.ts';
import { color, numberOrSignal } from '../scene/primitives.ts';
import { lerp, mix, read, type Actions, type WithEvents } from './shared.ts';

const point = z.tuple([z.number(), z.number()]);
const pulseCurve = z.strictObject({ base: z.number(), gain: z.number() });

export const params = z.strictObject({
  /** Bulb i of count sits at lerp(from, to, i/(count−1)) with sag·sin(f·π) added to y. */
  count: z.number().int().min(2),
  from: point,
  to: point,
  sag: z.number(),
  wire: z.strictObject({ width: z.number().positive(), color }),
  bulb: z.strictObject({ size: z.number().positive(), dy: z.number(), dark: color, colors: z.array(color).min(1) }),
  /** Every `period`-th bulb (shifting each step of floor(t × rate)) is dimmed to `dim`. */
  chase: z.strictObject({ period: z.number().int().positive(), dim: z.number(), rate: z.number().positive() }),
  /** Bulb colour blend = on × (base + gain·pulse). */
  colorPulse: pulseCurve,
  glow: z.strictObject({
    radius: z.number().positive(),
    dx: z.number(),
    dy: z.number(),
    alpha: z.number().min(0).max(1),
    pulse: pulseCurve,
    blur: z.strictObject({ strength: z.number(), quality: z.number().int().positive() }),
  }),
  /** Usually an on/off signal. */
  power: numberOrSignal,
});
export const actions: Actions = {};
type Config = WithEvents<z.infer<typeof params>>;

/** Bulbs on a sagging wire with a chase pattern (the pole is a separate shape asset). */
export function stringLights(id: string): SceneComponent<Config> {
  let cfg!: Config;
  let bulbs!: Graphics;
  let bulbGlow!: Graphics;
  const BULBS: [number, number][] = [];
  return {
    id,
    build(config) {
      cfg = config;
      const root = new Container();
      const wire = new Graphics();
      root.addChild(wire);
      bulbs = new Graphics();
      root.addChild(bulbs);
      bulbGlow = new Graphics();
      bulbGlow.filters = [new BlurFilter({ strength: cfg.glow.blur.strength, quality: cfg.glow.blur.quality })];
      bulbGlow.blendMode = 'add';
      root.addChild(bulbGlow);
      const [x0, y0] = cfg.from;
      const [x1, y1] = cfg.to;
      for (let i = 0; i <= cfg.count - 1; i++) {
        const f = i / (cfg.count - 1);
        BULBS.push([lerp(x0, x1, f), lerp(y0, y1, f) + Math.sin(f * Math.PI) * cfg.sag]);
      }
      wire.moveTo(x0, y0);
      BULBS.forEach(([x, y]) => wire.lineTo(x, y));
      wire.stroke({ width: cfg.wire.width, color: cfg.wire.color });
      return root;
    },
    update(ctx) {
      const { t, pulse: p } = ctx;
      const { bulb, chase, colorPulse, glow } = cfg;
      const bi = Math.floor(t * chase.rate);
      const on0 = read(cfg.power, ctx);
      bulbs.clear();
      bulbGlow.clear();
      BULBS.forEach(([x, y], i) => {
        const on = ((i + bi) % chase.period !== 0 ? 1 : chase.dim) * on0;
        const c = bulb.colors[i % bulb.colors.length] as number;
        bulbs.rect(Math.round(x), Math.round(y) + bulb.dy, bulb.size, bulb.size).fill(mix(bulb.dark, c, on * (colorPulse.base + colorPulse.gain * p)));
        bulbGlow.circle(x + glow.dx, y + glow.dy, glow.radius).fill({ color: c, alpha: glow.alpha * on * (glow.pulse.base + glow.pulse.gain * p) });
      });
    },
  };
}
