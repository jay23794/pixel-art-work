import { Container, Graphics } from 'pixi.js';
import { z } from 'zod';
import { parallaxX } from '../camera/camera.ts';
import type { SceneComponent } from '../core/component.ts';
import { color, count, numberOrSignal, parallax, randomValue } from '../scene/primitives.ts';
import { read, type Actions, type WithEvents } from './shared.ts';

export const params = z.strictObject({
  count,
  color,
  x: randomValue,
  y: randomValue,
  phase: randomValue,
  speed: randomValue,
  /** x = round(x0 + sin(t·speed + phase) × wobbleX) */
  wobbleX: z.number(),
  /** y = round(y0 + cos(t·speed·wobbleYSpeed + phase) × wobbleY − (t·riseSpeed mod riseWrap)) */
  wobbleY: z.number(),
  wobbleYSpeed: z.number(),
  riseSpeed: z.number(),
  riseWrap: z.number().positive(),
  /** alpha = (base + pulse·ctx.pulse) × (0.5 + 0.5·sin(t·twinkleSpeed + phase)) × power */
  alpha: z.strictObject({ base: z.number(), pulse: z.number() }),
  twinkleSpeed: z.number(),
  /** Usually an on/off signal. */
  power: numberOrSignal,
  parallax,
});
export const actions: Actions = {};
type Config = WithEvents<z.infer<typeof params>>;

interface Mote {
  g: Graphics;
  x: number;
  y: number;
  ph: number;
  sp: number;
}

/** Additive dust motes drifting in the light. rng per mote: (x, y, phase, speed). */
export function dust(id: string): SceneComponent<Config> {
  let cfg!: Config;
  let c!: Container;
  const DUST: Mote[] = [];
  return {
    id,
    build(config, rng) {
      cfg = config;
      c = new Container();
      c.blendMode = 'add';
      for (let i = 0; i < cfg.count; i++) {
        const g = new Graphics();
        g.rect(0, 0, 1, 1).fill(cfg.color);
        c.addChild(g);
        const x = cfg.x.base + rng.next() * cfg.x.random;
        const y = cfg.y.base + rng.next() * cfg.y.random;
        const ph = cfg.phase.base + rng.next() * cfg.phase.random;
        const sp = cfg.speed.base + rng.next() * cfg.speed.random;
        DUST.push({ g, x, y, ph, sp });
      }
      return c;
    },
    update(ctx) {
      const { t, pulse: p } = ctx;
      const k = cfg;
      const off = read(k.power, ctx);
      for (const d of DUST) {
        d.g.x = Math.round(d.x + Math.sin(t * d.sp + d.ph) * k.wobbleX);
        d.g.y = Math.round(d.y + Math.cos(t * d.sp * k.wobbleYSpeed + d.ph) * k.wobbleY - ((t * k.riseSpeed) % k.riseWrap));
        d.g.alpha = (k.alpha.base + k.alpha.pulse * p) * (0.5 + 0.5 * Math.sin(t * k.twinkleSpeed + d.ph)) * off;
      }
      c.x = parallaxX(ctx.camera, k.parallax);
    },
  };
}
