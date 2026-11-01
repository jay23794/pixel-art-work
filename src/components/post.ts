import { ColorMatrixFilter, NoiseFilter, type Filter } from 'pixi.js';
import { z } from 'zod';
import type { FrameContext } from '../core/context.ts';

// Post-processing effects. The factory applies them, in order, as the world's filters.

export interface PostEffect {
  readonly filter: Filter;
  update(ctx: FrameContext): void;
}

export interface PostEffectType<P> {
  readonly params: z.ZodType<P>;
  create(params: P): PostEffect;
}

/** Brightness = brightness + envGain·ctx.env + pulseGain·ctx.pulse, set every frame. */
export const grade: PostEffectType<{ brightness: number; envGain: number; pulseGain: number }> = {
  params: z.strictObject({ brightness: z.number(), envGain: z.number().default(0), pulseGain: z.number().default(0) }),
  create(p) {
    const filter = new ColorMatrixFilter();
    return {
      filter,
      update(ctx) {
        filter.reset();
        filter.brightness(p.brightness + p.envGain * ctx.env + p.pulseGain * ctx.pulse, false);
      },
    };
  },
};

/** Film grain. The seed steps through `cycle` values, one per frame: (n mod cycle) / cycle. */
export const noise: PostEffectType<{ amount: number; seed: number; cycle: number }> = {
  params: z.strictObject({ amount: z.number().min(0).max(1), seed: z.number().default(0.5), cycle: z.number().int().positive() }),
  create(p) {
    const filter = new NoiseFilter({ noise: p.amount, seed: p.seed });
    return {
      filter,
      update(ctx) {
        filter.seed = (ctx.n % p.cycle) / p.cycle;
      },
    };
  },
};
