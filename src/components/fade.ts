import { Graphics } from 'pixi.js';
import type { SceneComponent } from '../core/component.ts';

/** Fade from black over the first 1.5 s and to black from 38.3 s. Screen layer. */
export function fade(id = 'fade'): SceneComponent<void> {
  let g!: Graphics;
  return {
    id,
    build(_cfg, _rng, ctx0) {
      g = new Graphics();
      g.rect(0, 0, ctx0.width, ctx0.height).fill(0x000000);
      return g;
    },
    update(ctx) {
      const { t } = ctx;
      let f = 0;
      if (t < 1.5) f = 1 - t / 1.5;
      if (t > 38.3) f = Math.min(1, (t - 38.3) / 1.7);
      g.alpha = f;
    },
  };
}
