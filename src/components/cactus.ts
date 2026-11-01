import { Graphics } from 'pixi.js';
import type { SceneComponent } from '../core/component.ts';

export interface CactusConfig {
  /** Trunk left edge and ground line. */
  x: number;
  y: number;
  h: number;
  color: number;
}

/** Saguaro silhouette. Static (no parallax, as in legacy). */
export function cactus(id: string): SceneComponent<CactusConfig> {
  return {
    id,
    build({ x, y, h, color: col }) {
      const g = new Graphics();
      g.rect(x, y - h, 4, h).fill(col);
      g.rect(x - 5, y - h * 0.62, 5, 3).fill(col);
      g.rect(x - 5, y - h * 0.62 - 9, 3, 10).fill(col);
      g.rect(x + 4, y - h * 0.45, 5, 3).fill(col);
      g.rect(x + 6, y - h * 0.45 - 7, 3, 8).fill(col);
      return g;
    },
    update() {},
  };
}
