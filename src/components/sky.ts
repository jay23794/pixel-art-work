import { Graphics } from 'pixi.js';
import type { SceneComponent } from '../core/component.ts';
import { mix } from './shared.ts';

/** Banded night-sky gradient. Static. */
export function sky(id = 'sky'): SceneComponent<void> {
  return {
    id,
    build(_cfg, _rng, ctx0) {
      const W = ctx0.width;
      const g = new Graphics();
      const skyCols = [0x070614, 0x0d0b26, 0x161338, 0x23194a, 0x3a2253, 0x5a2c55, 0x7e3a52];
      const bands = 28;
      for (let i = 0; i < bands; i++) {
        const f = (i / (bands - 1)) * (skyCols.length - 1),
          k = Math.min(Math.floor(f), skyCols.length - 2);
        g.rect(-40, i * (560 / bands), W + 80, 560 / bands + 1).fill(
          mix(skyCols[k] as number, skyCols[k + 1] as number, Math.round((f - k) * 3) / 3),
        );
      }
      return g;
    },
    update() {},
  };
}
