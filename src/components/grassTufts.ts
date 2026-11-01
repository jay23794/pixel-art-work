import { Container, Graphics } from 'pixi.js';
import { parallaxX } from '../camera/camera.ts';
import type { SceneComponent } from '../core/component.ts';

interface Tuft {
  g: Graphics;
  x: number;
  ph: number;
}

/** Swaying grass tufts on the foreground dune. rng: 16 × (x, ph). */
export function grassTufts(id = 'grassTufts'): SceneComponent<void> {
  let root!: Container;
  const TUFTS: Tuft[] = [];
  return {
    id,
    build(_cfg, rng, ctx0) {
      const W = ctx0.width;
      root = new Container();
      for (let i = 0; i < 16; i++) {
        const g = new Graphics();
        root.addChild(g);
        const x = rng.next() * (W + 80) - 40;
        const ph = rng.next() * 6.28;
        TUFTS.push({ g, x, ph });
      }
      return root;
    },
    update(ctx) {
      const { t } = ctx;
      for (const u of TUFTS) {
        const s = Math.round(Math.sin(t * 1.5 + u.ph) * 1.5);
        u.g.clear();
        for (let k = -2; k <= 2; k++)
          u.g.moveTo(u.x + k * 2, 746).lineTo(u.x + k * 3 + s, 734 + Math.abs(k) * 2).stroke({ width: 1, color: 0x0e0a10 });
      }
      root.x = parallaxX(t, 1.2);
    },
  };
}
