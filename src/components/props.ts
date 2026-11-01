import { Container, Graphics } from 'pixi.js';
import { z } from 'zod';
import type { SceneComponent } from '../core/component.ts';
import { shape } from '../scene/primitives.ts';
import { drawShapes, type Actions, type WithEvents } from './shared.ts';

export const params = z.strictObject({ shapes: z.array(shape) });
export const actions: Actions = {};
type Config = WithEvents<z.infer<typeof params>>;

/** Static set dressing drawn from a shape list (e.g. chair and crate). */
export function props(id: string): SceneComponent<Config> {
  return {
    id,
    build(cfg) {
      const root = new Container();
      const g = new Graphics();
      drawShapes(g, cfg.shapes);
      root.addChild(g);
      return root;
    },
    update() {},
  };
}
