import { Container, Graphics } from 'pixi.js';
import { z } from 'zod';
import type { SceneComponent } from '../core/component.ts';
import { createRng } from '../core/random.ts';
import { color, numberOrSignal } from '../scene/primitives.ts';
import { mix, read, type Actions, type WithEvents } from './shared.ts';

export const params = z.strictObject({
  /** Centre x and the ceiling y the fixture hangs from. */
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int().min(6),
  colors: z.strictObject({ housing: color, shadow: color, tubeOff: color, tubeOn: color, beam: color }),
  /** Additive light cone down to y + length, widening by `spread` px on each side, in `steps` bands (brighter in the middle). */
  beam: z.strictObject({ length: z.number().positive(), spread: z.number().nonnegative(), steps: z.number().int().positive(), alpha: z.number().min(0).max(1) }),
  /** Faulty tube: in each 1/rate s step it is dimmed to `dim` with probability `chance`. */
  flicker: z.strictObject({ rate: z.number().positive(), chance: z.number().min(0).max(1), dim: z.number().min(0).max(1) }).optional(),
  /** 0 = off, 1 = on. Usually a signal. */
  power: numberOrSignal,
});
export const actions: Actions = {};
type Config = WithEvents<z.infer<typeof params>>;

/** A fluorescent ceiling fixture with a soft light cone. rng: the flicker pattern's seed. */
export function ceilingLight(id: string): SceneComponent<Config> {
  let cfg!: Config;
  let tube!: Graphics;
  let beam!: Graphics;
  let flickerSeed = 0;
  return {
    id,
    build(config, rng) {
      cfg = config;
      const { x, y, width, colors: c, beam: b } = cfg;
      flickerSeed = rng.int(0, 0x7fffffff);
      const left = x - Math.floor(width / 2);
      const root = new Container();
      beam = new Graphics();
      for (let s = 0; s < b.steps; s++) {
        const f = 1 - s / b.steps; // outer → inner bands
        const top = left + 2 + Math.round((s * (width - 4)) / (2 * b.steps)),
          topW = width - 4 - 2 * (top - left - 2),
          spread = Math.round(b.spread * f);
        beam.poly([top, y + 6, top + topW, y + 6, top + topW + spread, y + 6 + b.length, top - spread, y + 6 + b.length]).fill({
          color: c.beam,
          alpha: b.alpha / b.steps,
        });
      }
      beam.blendMode = 'add';
      root.addChild(beam);
      const body = new Graphics();
      body.rect(x - 1, y, 2, 2).fill(c.shadow);
      body.rect(left, y + 2, width, 3).fill(c.housing);
      body.rect(left, y + 5, width, 1).fill(c.shadow);
      root.addChild(body);
      tube = new Graphics();
      root.addChild(tube);
      return root;
    },
    update(ctx) {
      let level = read(cfg.power, ctx);
      const f = cfg.flicker;
      if (f && level > 0) {
        const step = Math.floor(ctx.t * f.rate);
        if (createRng((flickerSeed + Math.imul(step, 0x9e3779b1)) >>> 0).next() < f.chance) level *= f.dim;
      }
      const left = cfg.x - Math.floor(cfg.width / 2);
      tube.clear();
      tube.rect(left + 1, cfg.y + 5, cfg.width - 2, 2).fill(mix(cfg.colors.tubeOff, cfg.colors.tubeOn, level));
      beam.alpha = level;
    },
  };
}
