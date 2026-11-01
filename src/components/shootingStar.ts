import { Graphics } from 'pixi.js';
import { parallaxX } from '../camera/camera.ts';
import type { SceneComponent } from '../core/component.ts';

/** Two shooting stars, at ~23.5 s and ~32.8 s. */
export function shootingStar(id = 'shootingStar'): SceneComponent<void> {
  let g!: Graphics;
  return {
    id,
    build() {
      g = new Graphics();
      return g;
    },
    update(ctx) {
      const { t } = ctx;
      g.clear();
      [
        [23.45, 40, 60],
        [32.83, 150, 30],
      ].forEach(([s, sx, sy]) => {
        const a = (t - (s as number)) / 0.9;
        if (a > 0 && a < 1) {
          const x = (sx as number) + a * 90,
            y = (sy as number) + a * 45;
          for (let k = 0; k < 14; k++)
            g.rect(Math.round(x - k * 2), Math.round(y - k), 1, 1).fill({ color: 0xffffff, alpha: (1 - k / 14) * (1 - a) });
        }
      });
      g.x = parallaxX(t, 0.3);
    },
  };
}
