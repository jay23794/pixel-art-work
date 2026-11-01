import { BlurFilter, Container, Graphics } from 'pixi.js';
import { z } from 'zod';
import type { SceneComponent } from '../core/component.ts';
import { color, count, numberOrSignal, randomValue } from '../scene/primitives.ts';
import { durationParams, mix, read, type Actions, type WithEvents } from './shared.ts';

const wobble = z.strictObject({ speed: z.number(), amount: z.number() });

export const params = z.strictObject({
  count,
  /** Puff i starts at age i/count of the cycle; ages loop every `cycle` seconds. */
  cycle: z.number().positive(),
  radius: z.number().positive(),
  color,
  /** Vent position. */
  x: z.number(),
  y: z.number(),
  /** Per puff: horizontal drift (rng − 0.5) × spread, size factor, wobble phase. */
  spread: z.number(),
  size: randomValue,
  phase: randomValue,
  rise: z.number(),
  /** Extra sideways drift: age² × wind. */
  wind: z.number(),
  wobbleX: wobble,
  wobbleY: wobble,
  /** scale = (base + age × growth) × size */
  scale: z.strictObject({ base: z.number(), growth: z.number() }),
  maxAlpha: z.number().min(0).max(1),
  /** Tint blends cool → warm by max(0, warmAge − age) × level × warmth. */
  tint: z.strictObject({ cool: color, warm: color, warmAge: z.number(), warmth: z.number() }),
  /** Underlighting level, usually a signal. */
  level: numberOrSignal,
  blur: z.strictObject({ strength: z.number(), quality: z.number().int().positive() }),
});
/** fadeOut: fades the smoke out over `duration` seconds. */
export const actions: Actions = { fadeOut: durationParams };
type Config = WithEvents<z.infer<typeof params>>;

interface Puff {
  g: Graphics;
  off: number;
  dx: number;
  r: number;
  wob: number;
}

/** Rising smoke puffs. rng per puff: (drift, size, phase). */
export function smoke(id: string): SceneComponent<Config> {
  let cfg!: Config;
  let fades: { time: number; duration: number }[] = [];
  const PUFFS: Puff[] = [];
  return {
    id,
    build(config, rng) {
      cfg = config;
      fades = cfg.events.filter((e) => e.action === 'fadeOut').map((e) => ({ time: e.time, duration: e.params.duration as number }));
      const root = new Container();
      const smokeC = new Container();
      smokeC.filters = [new BlurFilter({ strength: cfg.blur.strength, quality: cfg.blur.quality })];
      root.addChild(smokeC);
      for (let i = 0; i < cfg.count; i++) {
        const g = new Graphics();
        g.circle(0, 0, cfg.radius).fill(cfg.color);
        smokeC.addChild(g);
        const off = (i / cfg.count) * cfg.cycle;
        const dx = (rng.next() - 0.5) * cfg.spread;
        const r = cfg.size.base + rng.next() * cfg.size.random;
        const wob = cfg.phase.base + rng.next() * cfg.phase.random;
        PUFFS.push({ g, off, dx, r, wob });
      }
      return root;
    },
    update(ctx) {
      const { t } = ctx;
      const c = cfg;
      const lw = read(c.level, ctx);
      let fade = 1;
      for (const f of fades) if (t > f.time) fade = (f.time + f.duration - t) / f.duration;
      for (const q of PUFFS) {
        const a = ((t + q.off) % c.cycle) / c.cycle; // age 0..1
        q.g.x = c.x + q.dx * a + a * a * c.wind + Math.sin(t * c.wobbleX.speed + q.wob) * c.wobbleX.amount * a;
        q.g.y = c.y - a * c.rise + Math.cos(t * c.wobbleY.speed + q.wob) * c.wobbleY.amount * a;
        q.g.scale.set((c.scale.base + a * c.scale.growth) * q.r);
        q.g.alpha = Math.sin(a * Math.PI) * c.maxAlpha * fade;
        q.g.tint = mix(c.tint.cool, c.tint.warm, Math.max(0, c.tint.warmAge - a) * lw * c.tint.warmth);
      }
    },
  };
}
