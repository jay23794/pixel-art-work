import { Container, Graphics } from 'pixi.js';
import type { SceneComponent } from '../core/component.ts';
import { campRoot, placeAtCamp } from './shared.ts';

/** Camp chair and crate. Camp group. */
export function props(id = 'props'): SceneComponent<void> {
  let root!: Container;
  return {
    id,
    build() {
      root = campRoot();
      const g = new Graphics();
      g.rect(70, -9, 10, 2).fill(0x5a2a2a);
      g.rect(70, -17, 2, 10).fill(0x5a2a2a);
      g.rect(70, -7, 1, 7).fill(0x222);
      g.rect(79, -7, 1, 7).fill(0x222);
      g.rect(-36, -8, 12, 8).fill(0x4a3424);
      g.rect(-36, -5, 12, 1).fill(0x2a1c14);
      root.addChild(g);
      return root;
    },
    update(ctx) {
      placeAtCamp(root, ctx.t);
    },
  };
}
