import { Graphics } from 'pixi.js';
import { parallaxX } from '../camera/camera.ts';
import type { SceneComponent } from '../core/component.ts';
import { WORLD_H } from './shared.ts';

export interface RidgeConfig {
  color: number;
  /** Baseline y in world pixels. */
  base: number;
  amp: number;
  freq: number;
  phase: number;
  /** Clamp peaks into flat mesa tops. */
  flatTop: boolean;
  /** Pan factor for parallax. */
  parallax: number;
}

/** Silhouette of hills/mesas filled down to the bottom of the world. */
export function ridge(id: string): SceneComponent<RidgeConfig> {
  let g!: Graphics;
  let parallax = 0;
  return {
    id,
    build({ color, base, amp, freq, phase, flatTop, parallax: p }, _rng, ctx0) {
      const W = ctx0.width;
      parallax = p;
      g = new Graphics();
      const pts = [-60, WORLD_H];
      for (let x = -60; x <= W + 60; x += 3) {
        let y =
          base -
          amp * (0.6 * Math.sin(x * freq + phase) + 0.3 * Math.sin(x * freq * 2.7 + phase * 2) + 0.1 * Math.sin(x * freq * 6.1));
        if (flatTop) y = Math.min(y, base - amp * 0.55) + (Math.sin(x * 0.7) > 0.95 ? 1 : 0); // mesa tops
        pts.push(x, Math.round(y));
      }
      pts.push(W + 60, WORLD_H);
      g.poly(pts).fill(color);
      return g;
    },
    update(ctx) {
      g.x = parallaxX(ctx.t, parallax);
    },
  };
}
