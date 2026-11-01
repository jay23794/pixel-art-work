import { Container, Graphics } from 'pixi.js';
import type { SceneComponent } from '../core/component.ts';
import { campRoot, lightsOn, placeAtCamp } from './shared.ts';

/** Generator with a blinking LED and a cable to the trailer. Camp group. */
export function generator(id = 'generator'): SceneComponent<void> {
  let root!: Container;
  let led!: Graphics;
  return {
    id,
    build() {
      root = campRoot();
      const gen = new Graphics();
      gen.rect(-82, -12, 16, 12).fill(0x2a2c30);
      gen.rect(-80, -10, 12, 3).fill(0x1a1b1e);
      root.addChild(gen);
      led = new Graphics();
      root.addChild(led);
      const cable = new Graphics();
      cable.moveTo(-66, -2).quadraticCurveTo(-60, 2, -52, -6).stroke({ width: 1, color: 0x111114 });
      root.addChild(cable);
      return root;
    },
    update(ctx) {
      placeAtCamp(root, ctx.t);
      led.clear();
      led.rect(-70, -9, 1, 1).fill(Math.floor(ctx.t * 2) % 2 && lightsOn(ctx.t) ? 0x40ff70 : 0x0c3a18);
    },
  };
}
