import { Graphics } from 'pixi.js';
import { parallaxX } from '../camera/camera.ts';
import type { SceneComponent } from '../core/component.ts';

/** Banded sand with scattered specks. rng: 160 × (x, y). */
export function ground(id = 'ground'): SceneComponent<void> {
  let g!: Graphics;
  return {
    id,
    build(_cfg, rng, ctx0) {
      const W = ctx0.width;
      g = new Graphics();
      const gcols = [0x3a2228, 0x34202a, 0x2c1b26, 0x231621, 0x1a111b];
      gcols.forEach((c, i) => g.rect(-60, 618 + i * 28, W + 120, i === 4 ? 200 : 30).fill(c));
      for (let i = 0; i < 160; i++)
        g.rect(Math.round(rng.next() * (W + 100) - 50), Math.round(622 + rng.next() * 140), 1, 1).fill({ color: 0x6a4a44, alpha: 0.5 });
      return g;
    },
    update(ctx) {
      g.x = parallaxX(ctx.t, 0.7);
    },
  };
}
