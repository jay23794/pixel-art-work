import { BlurFilter, Container, Graphics } from 'pixi.js';
import type { SceneComponent } from '../core/component.ts';
import { bulbsOn, campRoot, lerp, mix, placeAtCamp } from './shared.ts';

/** Bulbs on a wire from the trailer to a pole; chase steps twice a second. Camp group. */
export function stringLights(id = 'stringLights'): SceneComponent<void> {
  let root!: Container;
  let bulbs!: Graphics;
  let bulbGlow!: Graphics;
  const BULBS: [number, number][] = [];
  return {
    id,
    build() {
      root = campRoot();
      const pole = new Graphics();
      pole.rect(96, -54, 2, 54).fill(0x1c1418);
      root.addChild(pole);
      const wire = new Graphics();
      root.addChild(wire);
      bulbs = new Graphics();
      root.addChild(bulbs);
      bulbGlow = new Graphics();
      bulbGlow.filters = [new BlurFilter({ strength: 4, quality: 3 })];
      bulbGlow.blendMode = 'add';
      root.addChild(bulbGlow);
      for (let i = 0; i <= 9; i++) {
        const f = i / 9;
        BULBS.push([lerp(40, 96, f), lerp(-40, -54, f) + Math.sin(f * Math.PI) * 9]);
      }
      wire.moveTo(40, -40);
      BULBS.forEach(([x, y]) => wire.lineTo(x, y));
      wire.stroke({ width: 1, color: 0x120c10 });
      return root;
    },
    update(ctx) {
      const { t, pulse: p } = ctx;
      placeAtCamp(root, t);
      const bi = Math.floor(t * 2);
      const bulbsOff = bulbsOn(t);
      bulbs.clear();
      bulbGlow.clear();
      BULBS.forEach(([x, y], i) => {
        const on = ((i + bi) % 3 !== 0 ? 1 : 0.35) * bulbsOff * (t > 2 ? 1 : 0);
        const c = [0xffd27a, 0x52e0d0, 0xff6a8a][i % 3] as number;
        bulbs.rect(Math.round(x), Math.round(y) + 1, 2, 2).fill(mix(0x201a18, c, on * (0.6 + 0.4 * p)));
        bulbGlow.circle(x + 1, y + 2, 4).fill({ color: c, alpha: 0.5 * on * (0.5 + 0.5 * p) });
      });
    },
  };
}
