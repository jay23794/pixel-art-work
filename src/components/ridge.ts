import { Graphics } from 'pixi.js';
import { z } from 'zod';
import { parallaxX } from '../camera/camera.ts';
import type { SceneComponent } from '../core/component.ts';
import { color, parallax } from '../scene/primitives.ts';
import type { Actions, WithEvents } from './shared.ts';

export const params = z.strictObject({
  color,
  /** Baseline y in world pixels. */
  base: z.number(),
  amp: z.number(),
  freq: z.number(),
  phase: z.number(),
  /** y = base − amp × Σ weight·sin(x·freq·freqMul + phase·phaseMul) */
  harmonics: z.array(z.strictObject({ weight: z.number(), freqMul: z.number(), phaseMul: z.number() })).min(1),
  /** Outline from xMin to xMax (inclusive) every `step` px, filled down to `bottom`. */
  xMin: z.number(),
  xMax: z.number(),
  step: z.number().positive(),
  bottom: z.number(),
  /** Flat mesa tops: y = min(y, base − amp·clamp), plus `bump` px where sin(x·bumpFreq) > bumpThreshold. */
  mesa: z.strictObject({ clamp: z.number(), bumpFreq: z.number(), bumpThreshold: z.number(), bump: z.number() }).optional(),
  parallax,
});
export const actions: Actions = {};
type Config = WithEvents<z.infer<typeof params>>;

/** Silhouette of hills/mesas filled down to `bottom`. */
export function ridge(id: string): SceneComponent<Config> {
  let g!: Graphics;
  let factor = 0;
  return {
    id,
    build(cfg) {
      const { base, amp, freq, phase, mesa } = cfg;
      factor = cfg.parallax;
      g = new Graphics();
      const pts = [cfg.xMin, cfg.bottom];
      for (let x = cfg.xMin; x <= cfg.xMax; x += cfg.step) {
        let sum = 0;
        for (const h of cfg.harmonics) sum += h.weight * Math.sin(x * freq * h.freqMul + phase * h.phaseMul);
        let y = base - amp * sum;
        if (mesa) y = Math.min(y, base - amp * mesa.clamp) + (Math.sin(x * mesa.bumpFreq) > mesa.bumpThreshold ? mesa.bump : 0);
        pts.push(x, Math.round(y));
      }
      pts.push(cfg.xMax, cfg.bottom);
      g.poly(pts).fill(cfg.color);
      return g;
    },
    update(ctx) {
      g.x = parallaxX(ctx.camera, factor);
    },
  };
}
