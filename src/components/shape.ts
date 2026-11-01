import { Graphics } from 'pixi.js';
import { z } from 'zod';
import { parallaxX } from '../camera/camera.ts';
import type { SceneComponent } from '../core/component.ts';
import { parallax, type ShapeAsset } from '../scene/primitives.ts';
import { drawShapes, type Actions, type WithEvents } from './shared.ts';

export const params = z.strictObject({
  /** Id of a shape asset (assets/shapes/<id>.json). */
  asset: z.string(),
  /** Where the asset's anchor lands. */
  x: z.number(),
  y: z.number(),
  parallax,
});
export const actions: Actions = {};
/** The loader attaches the validated asset as `shapeAsset`. */
type Config = WithEvents<z.infer<typeof params>> & { readonly shapeAsset: ShapeAsset };

/** Places static drawn art from a shape asset. */
export function shape(id: string): SceneComponent<Config> {
  let g!: Graphics;
  let x = 0;
  let factor = 0;
  return {
    id,
    build(cfg) {
      x = cfg.x;
      factor = cfg.parallax;
      g = new Graphics();
      drawShapes(g, cfg.shapeAsset.shapes, cfg.shapeAsset.anchor.x, cfg.shapeAsset.anchor.y);
      g.x = cfg.x;
      g.y = cfg.y;
      return g;
    },
    update(ctx) {
      if (factor !== 0) g.x = x + parallaxX(ctx.camera, factor);
    },
  };
}
