import { Graphics } from 'pixi.js';
import { z } from 'zod';
import type { SceneComponent } from '../core/component.ts';
import { color } from '../scene/primitives.ts';
import { mix, type Actions, type WithEvents } from './shared.ts';

export const params = z.strictObject({
  colors: z.array(color).min(2),
  bands: z.number().int().min(2),
  x: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  /** Extra pixels on each band so neighbours overlap. */
  overlap: z.number().default(0),
  /** Blend steps between neighbouring colours (banding). */
  steps: z.number().int().positive(),
});
export const actions: Actions = {};
type Config = WithEvents<z.infer<typeof params>>;

/** Banded gradient. Static. */
export function sky(id: string): SceneComponent<Config> {
  return {
    id,
    build({ colors, bands, x, width, height, overlap, steps }) {
      const g = new Graphics();
      for (let i = 0; i < bands; i++) {
        const f = (i / (bands - 1)) * (colors.length - 1),
          k = Math.min(Math.floor(f), colors.length - 2);
        g.rect(x, i * (height / bands), width, height / bands + overlap).fill(
          mix(colors[k] as number, colors[k + 1] as number, Math.round((f - k) * steps) / steps),
        );
      }
      return g;
    },
    update() {},
  };
}
