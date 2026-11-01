import { Graphics } from 'pixi.js';
import { parallaxX } from '../camera/camera.ts';
import type { SceneComponent } from '../core/component.ts';

/** Diagonal band of faint dots. rng: 260 × (x, y, alpha). */
export function milkyWay(id = 'milkyWay'): SceneComponent<void> {
  let g!: Graphics;
  return {
    id,
    build(_cfg, rng, ctx0) {
      const W = ctx0.width;
      g = new Graphics();
      for (let i = 0; i < 260; i++) {
        const x = rng.next() * (W + 120) - 60,
          y = 40 + x * 0.9 + (rng.next() - 0.5) * 70;
        g.rect(Math.round(x), Math.round(y), 1, 1).fill({ color: 0xb8a8ff, alpha: 0.18 + rng.next() * 0.2 });
      }
      return g;
    },
    update(ctx) {
      g.x = parallaxX(ctx.t, 0.1);
    },
  };
}
