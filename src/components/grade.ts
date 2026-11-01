import { ColorMatrixFilter, Container, NoiseFilter, type Filter } from 'pixi.js';
import type { SceneComponent } from '../core/component.ts';

export interface GradeComponent extends SceneComponent<void> {
  /** Assign to the world container's filters after build. Order: colour matrix, then noise. */
  readonly filters: readonly Filter[];
}

/** Brightness grade plus film grain over the whole world. Draws nothing itself. */
export function grade(id = 'grade'): GradeComponent {
  const noise = new NoiseFilter({ noise: 0.06, seed: 0.3 });
  const color = new ColorMatrixFilter();
  return {
    id,
    filters: [color, noise],
    build() {
      return new Container();
    },
    update(ctx) {
      color.reset();
      color.brightness(0.9 + 0.18 * ctx.env + 0.06 * ctx.pulse, false);
      noise.seed = (ctx.n % 13) / 13;
    },
  };
}
