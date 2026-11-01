import { Container, Graphics } from 'pixi.js';
import { parallaxX } from '../camera/camera.ts';
import type { SceneComponent } from '../core/component.ts';

/** Crescent moon with a soft glow. */
export function moon(id = 'moon'): SceneComponent<void> {
  let c!: Container;
  return {
    id,
    build() {
      const glow = new Graphics();
      [38, 28, 20].forEach((r, i) => glow.circle(0, 0, r).fill({ color: 0xffe2b0, alpha: [0.05, 0.08, 0.12][i] as number }));
      const disc = new Graphics();
      disc.circle(0, 0, 13).fill(0xfff0d0);
      disc.circle(5, -3, 12).fill(0x1a1440);
      c = new Container();
      c.addChild(glow, disc);
      c.x = 205;
      c.y = 110;
      return c;
    },
    update(ctx) {
      c.x = 205 + parallaxX(ctx.t, 0.08);
    },
  };
}
